'use strict';

const results = {};
const cp = require('child_process');
const { promisify } = require('util');
const exec = promisify(cp.exec);
const os = require('os');

async function getOsInfo() {
  // node version
  results.nodeVersion = process.versions.node;

  // alinode version
  results.alinodeVersion = process.versions.alinode;

  // xtransit version
  results.xtransitVersion = require('../package.json').version;

  // ulimic -c
  if (os.platform() === 'win32') {
    results.ulimit = 'unlimited';
  } else {
    const { stdout } = await exec('ulimit -c', { encoding: 'utf8' });
    results.ulimit = stdout.trim();
  }

  // os info
  results.osInfo = `${os.type()}/${os.hostname()}/${os.platform()}/${os.arch()}/${os.release()}`;

  console.log(JSON.stringify(results));
}

getOsInfo().catch(err => console.error(err.message));
