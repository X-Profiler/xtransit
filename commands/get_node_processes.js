'use strict';

const os = require('os');
const cp = require('child_process');
const { promisify } = require('util');
const exec = promisify(cp.exec);
const { getNodeProcessInfo, isNumber, checkAlive } = require('../common/utils');

async function getNodeProcesses() {
  const platform = os.platform();
  const ignores = [
    'check_process_status',
    'check_processes_alive',
    'get_node_processes',
    'get_os_info',
    'which node',
    'wmic process',
    'findstr ',
  ];

  let cmd = '';

  /* istanbul ignore next */
  if (platform === 'win32') {
    cmd = 'wmic process get processid,commandline| findstr /C:"node.exe" /C:"pm2" /C:"iojs" /C:"node "';
  } else {
    cmd = 'ps -e -o pid,args | grep -E "node |iojs |PM2 " | grep -v grep';
  }

  const { stdout } = await exec(cmd, { encoding: 'utf8' });
  const result = stdout
    .trim()
    .split('\n')
    .filter(line => ignores.every(ignore => typeof line === 'string' && !line.includes(ignore)))
    .map(line => {
      const { pid, command } = getNodeProcessInfo(line, platform);
      let info;
      /* istanbul ignore else */
      if (isNumber(pid) && checkAlive(pid) && command) {
        info = [pid.trim(), command.trim()].join('\u0000');
      }
      return info;
    })
    .filter(item => item)
    .join('\n');

  console.log(result);
}

/* istanbul ignore next */
getNodeProcesses().catch(err => console.error(err.message));

