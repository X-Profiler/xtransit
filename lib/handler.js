'use strict';

const fs = require('fs');
const cp = require('child_process');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const execFile = promisify(cp.execFile);
const path = require('path');
const utils = require('../common/utils');
const getNodeExe = require('../common/exe');

/* istanbul ignore next */
function checkFileExist(filePath) {
  let count = 0;
  const timer = setInterval(async () => {
    // max 2min
    if (count > 60 * 2) {
      clearInterval(timer);
      this.sendMessage('action', { filePath });
    }
    count++;

    // check file exists
    if (!await exists(filePath)) {
      return;
    }
    clearInterval(timer);
    this.sendMessage('action', { filePath });
  }, 1000);
}

/* istanbul ignore next */
function checkActionFile(cmd, options, stdout, stderr) {
  if (cmd === 'xprofctl' && !stderr) {
    const extraTime = 3 * 1000;
    try {
      options = JSON.parse(options);
      const { filepath: filePath } = JSON.parse(stdout.trim());
      if (utils.isNumber(options.profiling_time)) {
        setTimeout(() => checkFileExist.call(this, filePath), options.profiling_time + extraTime);
      } else {
        setTimeout(() => checkFileExist.call(this, filePath), extraTime);
      }
    } catch (err) {
      this.logger.error(`checkActionFile failed: ${err.message}`);
    }
  }
}

async function realCommandFile(commands, file) {
  let find = false;
  for (const command of commands) {
    const tmp = path.join(command, file);
    if (!await exists(tmp)) {
      continue;
    }
    find = true;
    file = tmp;
  }
  return { find, file };
}

module.exports = async function(message) {
  try {
    this.logger.debug(`[from xtransit-server] >>>>>>>>>>>>>>>>>>> ${message}`);
    const data = JSON.parse(message);
    const { traceId, type } = data;

    // shutdown
    if (type === 'shutdown') {
      this.shutdown();
      return;
    }

    // exec command
    if (type === 'exec_command') {
      const { command, expiredTime, env } = data.data;

      // check command file
      const [cmd, ...args] = command.split(' ');
      const { find, file: commandFile } = await realCommandFile(this.commands, `${cmd}.js`);
      if (!find) {
        return this.sendMessage('response', { ok: false, message: `file ${cmd}.js not exists in [${this.commands.join(',')}]` }, traceId);
      }
      args.unshift(commandFile);

      // set exec options
      const execOptions = {
        timeout: expiredTime || 3000,
        env: Object.assign({
          XTRANSIT_AGENT_ID: utils.getAgentId(this.ipMode),
          XTRANSIT_LOGDIR: this.logdir,
          XTRANSIT_EXPIRED_TIME: expiredTime,
          XTRANSIT_TITLES: JSON.stringify(this.titles),
          XTRANSIT_CLEAN_AFTER_UPLOAD: this.cleanAfterUpload ? 'YES' : 'NO',
        }, process.env, env || {}),
      };

      // exec command
      const nodeExe = await getNodeExe(process.pid, false);
      this.logger.debug(`[execute command] ${nodeExe} ${args.join(' ')}`);
      const { stdout, stderr } = await execFile(nodeExe, args, execOptions);

      // check action file status
      checkActionFile.call(this, cmd, args.pop(), stdout, stderr, this.logger);

      return this.sendMessage('response', { ok: true, data: { stdout, stderr } }, traceId);
    }
  } catch (err) /* istanbul ignore next */ {
    this.logger.error(`handle message failed: ${err.stack}, raw message: ${message}`);
  }
};
