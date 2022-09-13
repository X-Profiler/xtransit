'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const realpath = promisify(fs.realpath);
const getNodeExe = require('../common/exe');

const args = process.argv.slice(2);
let pid,
  tid = 0,
  command,
  options;
if (args.length === 4) {
  [pid, tid, command, options] = args;
} else {
  [pid, command, options] = args;
}

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

    const { ok, data, message } = await require(xctl)(pid, tid, command, JSON.parse(options));
    if (!ok) {
      result = false;
      console.error(message);
      break;
    }

    result = true;

    // hanle coredump
    if (command === 'generate_coredump') {
      data.type = 'core';
      const nodepath = await realpath(await getNodeExe(process.pid, false));
      data.executable_path = nodepath;
      data.node_version = process.versions.node;
      data.alinode_version = process.versions.alinode;
    }

    console.log(JSON.stringify(data));
  }

  if (result === undefined) {
    console.error(`process <${pid}> not enable xprofiler`);
  }
}

takeAction().catch(err => console.error(err.message));
