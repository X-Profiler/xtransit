'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);

const [pid, command, options] = process.argv.slice(2);

async function takeAction() {
  const hiddenFile = path.join(os.homedir(), '.xprofiler');
  if (!await exists(hiddenFile)) {
    return console.error(`${hiddenFile} not exists`);
  }

  let result;
  const content = await readFile(hiddenFile, 'utf8');
  for (const proc of content.trim().split('\n')) {
    const [xpid, , , , , mod] = proc.split('\u0000');
    if (Number(pid) !== Number(xpid)) {
      continue;
    }

    // find xctl
    const xctl = path.join(mod, 'lib/xctl.js');
    if (!await exists(xctl)) {
      result = false;
      console.error(`${xctl} not exists`);
      break;
    }

    const { ok, data, message } = await require(xctl)(pid, command, JSON.parse(options));
    if (!ok) {
      result = false;
      console.error(message);
      break;
    }

    result = true;
    console.log(JSON.stringify(data));
  }

  if (result === undefined) {
    console.error(`process <${pid}> not enable xprofiler`);
  }
}

takeAction().catch(err => console.error(err.message));
