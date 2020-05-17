'use strict';

const results = {};
const cp = require('child_process');
const os = require('os');

// node version
results.nodeVersion = process.versions.node;

// xtransit version
results.xtransitVersion = require('../package.json').version;

// ulimic -c
if (os.platform() === 'win32') {
  results.ulimitC = 'unlimited';
} else {
  const ulimic = cp.execSync('ulimit -c');
  results.ulimit = ulimic.toString().trim();
}

// os info
results.osInfo = `${os.type()}/${os.hostname()}/${os.platform()}/${os.arch()}/${os.release()}`;

console.log(JSON.stringify(results));
