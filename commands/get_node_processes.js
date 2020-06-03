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
  ];

  let cmd = '';
  if (platform === 'win32') {
    cmd = 'wmic process get processid,commandline| findstr /C:"node.exe" /C:"pm2" /C:"iojs"';
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
      if (isNumber(pid) && checkAlive(pid) && command) {
        return [pid.trim(), command.trim()].join('\u0000');
      }
      return false;
    })
    .filter(item => item)
    .join('\n');

  console.log(result);
}

getNodeProcesses().catch(err => console.error(err.message));

