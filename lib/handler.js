'use strict';

const fs = require('fs');
const cp = require('child_process');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const execFile = promisify(cp.execFile);
const path = require('path');
const utils = require('../common/utils');
const getNodeExe = require('../common/exe');

module.exports = async function(message) {
  try {
    this.logger.debug(`[from xtransit-server] >>>>>>>>>>>>>>>>>>> ${message}`);
    const data = JSON.parse(message);
    const { traceId, type } = data;

    // shutdown
    if (type === 'shutdown') {
      return;
    }

    // exec command
    if (type === 'exec_command') {
      const { command, expiredTime, env } = data.data;

      // check command file
      const [cmd, ...args] = command.split(' ');
      const commandFile = path.join(__dirname, '../commands', `${cmd}.js`);
      if (!await exists(commandFile)) {
        return this.sendMessage('response', { ok: false, message: `file ${commandFile} not exists` }, traceId);
      }
      args.unshift(commandFile);

      // set exec options
      const execOptions = {
        timeout: expiredTime || 3000,
        env: Object.assign({
          XTRANSIT_AGENT_ID: utils.getAgentId(),
          XTRANSIT_LOGDIR: this.logdir,
        }, process.env, env || {}),
      };

      // exec command
      this.logger.debug(`execute command: ${command}, traceId: ${traceId}`);
      const nodeExe = await getNodeExe(process.pid);
      const { stdout, stderr } = await execFile(nodeExe, args, execOptions);
      return this.sendMessage('response', { ok: true, data: { stdout, stderr } }, traceId);
    }
  } catch (err) {
    this.logger.error(`handle message failed: ${err}, raw message: ${message}`);
  }
};
