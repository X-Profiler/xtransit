#!/usr/bin/env node
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cp = require('child_process');
// promisify
const { promisify } = require('util');
const exists = promisify(fs.exists);
const open = promisify(fs.open);
const close = promisify(fs.close);
const appendFile = promisify(fs.appendFile);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
// common libs
const { checkAlive } = require('../common/utils');
const helpText = require('../common/helper');
const getNodeExe = require('../common/exe');
// global vars
const SPLITTER = '\u0000';
const guard = path.join(__dirname, 'main');
const statusPath = path.join(os.homedir(), '.xtransit');

const listHeader =
  '|- App ID -|- PID -|---- Start Time -----|--- Config Path ------------------------------------|';

const listFooter =
  '|----------|-------|---------------------|----------------------------------------------------|';

function format(data, width) {
  data = data.toString();
  if (data.length >= width) {
    return data;
  }
  return ' '.repeat(width - data.length) + data;
}

function contentShaping(appId, pid, config, startTime) {
  appId = format(appId, 8);
  pid = format(pid, 5);
  config = format(config, 40);
  startTime = moment(startTime).format('YYYY-MM-DD HH:mm:ss');
  return '| ' + [appId, pid, startTime, config].join(' | ') + ' |';
}

async function appendStatus(appId, pid, config) {
  const line = [appId, pid, config, Date.now()].join(SPLITTER) + '\n';
  await appendFile(statusPath, line);
}

function killRunning(pid) {
  if (!pid) { return false; }
  try {
    process.kill(pid);
  } catch (ex) {
    return false;
  }
}

function isAppId(appId) {
  if (!appId) {
    return false;
  }

  appId = appId.toString();
  if (appId.length === 0) {
    return false;
  }

  return /\d*/.test(appId);
}

async function start(configPath) {
  if (!configPath) {
    console.log('config not provided.');
    console.log();
    console.log('Usage: ');
    console.log('    xtransit start /path/to/config(.js|json)');
    process.exit(1);
  }

  configPath = path.resolve(configPath);
  if (!await exists(configPath)) {
    console.log('%s not exists.', configPath);
    process.exit(1);
  }

  let cfg;
  try {
    cfg = require(configPath);
  } catch (ex) {
    console.log('%s must export a valid json.', configPath);
    console.log('Error stack:');
    console.log(ex.stack);
    process.exit(1);
  }

  if (!cfg.server || !cfg.appId || !cfg.appSecret) {
    console.log('`server`, `appId` and `appSecret` must be provided.');
    process.exit(1);
  }

  const appId = cfg.appId;
  const logPath = path.join(os.homedir(), '.xtransit.log');
  const out = await open(logPath, 'a');
  const err = await open(logPath, 'a');
  const nodeExe = await getNodeExe(process.pid, false);
  const proc = cp.spawn(nodeExe, [guard, configPath], {
    detached: true,
    stdio: ['ipc', out, err],
    env: process.env,
  });
  if (proc.pid) {
    console.log('xtransit has started(pid: %s).', proc.pid);
    await appendStatus(appId, proc.pid, configPath);
  } else {
    console.log('xtransit started failed.');
  }
  process.exit(0);
}

async function getAlives() {
  const raw = (await readFile(statusPath, 'utf8')).trim().split('\n');
  const clients = raw
    .filter(line => line.length > 0)
    .map(line => {
      const [appId, pid, config, startTime] = line.split(SPLITTER);
      return { appId, pid, config, startTime: Number(startTime) };
    });

  return clients.filter(item => checkAlive(item.pid));
}

async function writeBackAlives(alives) {
  await writeFile(statusPath, alives.map(item => {
    return [item.appId, item.pid, item.config, item.startTime].join(SPLITTER) + '\n';
  }).join(''));
}

async function list() {
  if (!exists(statusPath)) {
    console.log('There is no running client.');
    process.exit(0);
  }

  const alives = await getAlives();
  await writeBackAlives(alives);

  if (alives.length === 0) {
    console.log('There is no running client.');
    process.exit(0);
  }

  console.log(listHeader);
  alives.forEach(item => console.log(contentShaping(item.appId, item.pid, item.config, item.startTime)));
  console.log(listFooter);
  process.exit(0);
}

async function stopAll() {
  const alives = await getAlives();
  alives.forEach(item => killRunning(item.pid));
  await writeBackAlives([]);
}

async function stopApp(appId) {
  const alives = await getAlives();
  if (!alives.find(item => item.appId === appId)) {
    console.log(`There is no running client for appId: ${appId}.`);
    return;
  }

  const newlist = alives.filter(function(item) {
    if (item.appId === appId) {
      killRunning(item.pid);
      return false;
    }
    return true;
  });

  await writeBackAlives(newlist);
}

async function stop(input) {
  if (input === 'all') {
    await stopAll();
    process.exit(0);
  } else if (isAppId(input)) {
    await stopApp(input);
    process.exit(0);
  } else {
    console.log('xtransit stop all      stop all clients');
    console.log('xtransit stop <appId>  stop the client(s) for appId');
    process.exit(1);
  }
}

// start command
async function main() {
  if (!await exists(statusPath)) {
    await close(await open(statusPath, 'w'));
  }

  const argv = process.argv.slice(2);
  switch (argv[0]) {
    case '-v':
    case '--version':
    case 'version':
      console.log(require('../package.json').version);
      break;
    case '-h':
    case '--help':
    case 'help':
      console.log(helpText);
      break;
    case 'start':
      start(argv[1]);
      break;
    case 'list':
      list();
      break;
    case 'stop':
      stop(argv[1]);
      break;
    default:
      console.log(helpText);
  }
}

main();
