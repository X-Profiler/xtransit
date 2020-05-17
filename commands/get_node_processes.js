'use strict';

const os = require('os');
const cp = require('child_process');
const { getNodeProcessInfo, isNumber, checkAlive } = require('../common/utils');

const platform = os.platform();
const ignores = [
  'get_os_info.js',
  'get_node_processes.js',
];

let cmd = '';
if (platform === 'win32') {
  cmd = 'wmic process get processid,commandline| findstr /C:"node.exe" /C:"pm2" /C:"iojs"';
} else {
  cmd = 'ps -e -o pid,args | grep -E "node |iojs |PM2 " | grep -v grep';
}

let result = cp.execSync(cmd).toString();
result = result
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
