'use strict';

const fs = require('fs');
const { promisify } = require('util');
const os = require('os');
const cp = require('child_process');
const path = require('path');
const exec = promisify(cp.exec);
const exists = promisify(fs.exists);
const utils = require('../common/utils');
const platform = os.platform();

module.exports = async (pid, stringify = true) => {
  let nodeExe = 'node';

  /* istanbul ignore next */
  if (!utils.isNumber(pid)) {
    return nodeExe;
  }

  /* istanbul ignore next */
  if (platform === 'darwin') {
    try {
      const { stdout } = await exec(`lsof -a -d txt -p ${pid}| grep node`);
      let exeStdout = stdout.toString().trim();
      exeStdout = exeStdout.split('\n');
      for (let i = 0; i < exeStdout.length; i++) {
        const line = exeStdout[i];
        const elements = line.replace(/\s+/g, '\t').split('\t');
        const binary = elements.pop();
        const exec = path.basename(binary);
        if (exec === 'node') {
          nodeExe = binary;
        }
      }
    } catch (err) {
      err;
    }
  }

  /* istanbul ignore next */
  if (platform === 'linux') {
    const exePath = `/proc/${pid}/exe`;
    if (await exists(exePath)) {
      nodeExe = exePath;
    }
  }

  /* istanbul ignore next */
  if (platform === 'win32') {
    const { stdout } = await exec(`wmic process where "processid=${pid}" get executablepath`);
    let executable = stdout.toString().trim();
    executable = executable.split('\r\r')[1].trim();
    nodeExe = stringify ? JSON.stringify(executable) : executable;
  }

  return nodeExe;
};
