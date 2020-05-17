'use strict';

const fs = require('fs');
const { promisify } = require('util');
const os = require('os');
const cp = require('child_process');
const path = require('path');
const exec = promisify(cp.exec);
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const realpath = promisify(fs.realpath);
const utils = require('../common/utils');
const platform = os.platform();

async function getCwd(filePath) {
  try {
    filePath = await realpath(filePath);
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      return path.dirname(filePath);
    }
    return filePath;
  } catch (err) {
    err;
    return false;
  }
}

module.exports = async pid => {
  let processCwd = '';
  let processCmd = '';

  if (!utils.isNumber(pid)) {
    return processCwd;
  }

  if (platform === 'darwin') {
    try {
      // get cwd
      let { stdout: cwdStdout } = await exec(`lsof -a -d cwd -p ${pid}| grep -E "node |iojs |PM2 "`);
      cwdStdout = cwdStdout.toString().trim();
      cwdStdout = cwdStdout.replace(/\s+/g, '\t');
      processCwd = cwdStdout.split('\t').pop();

      // get cmd
      let { stdout: cmdStdout } = await exec(`ps -o command= -p ${pid} |awk '{ print $2 }'`);
      cmdStdout = cmdStdout.toString().trim();
      processCmd = cmdStdout;
    } catch (err) {
      err;
    }
  }

  if (platform === 'linux') {
    const cwdPath = `/proc/${pid}/cwd`;
    // get cwd
    processCwd = await realpath(cwdPath);

    // get cmd
    let { stdout: cmdStdout } = await exec(`ps -o cmd= -p ${pid} |awk '{ print $2 }'`);
    cmdStdout = cmdStdout.toString().trim();
    processCmd = cmdStdout;
  }

  if (processCmd) {
    if (path.isAbsolute(processCmd) && await exists(processCmd)) {
      const res = await getCwd(processCmd);
      if (res !== false) {
        processCwd = res;
      }
    } else {
      const tmp = path.join(processCwd, processCmd);
      if (await exists(tmp)) {
        const res = await getCwd(tmp);
        if (res !== false) {
          processCwd = res;
        }
      }
    }
  }

  return processCwd;
};
