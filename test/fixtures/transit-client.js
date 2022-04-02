'use strict';

const fs = require('fs');
const path = require('path');
const moment = require('moment');
const xtransit = require('../../xtransit');

// error logs
const errorLogContent = path.join(__dirname, './files/error');
const errorLogPath = path.join(__dirname, './files/test_error');
if (!fs.existsSync(errorLogPath)) {
  fs.writeFileSync(errorLogPath, '');
}
setTimeout(() => fs.writeFileSync(errorLogPath, fs.readFileSync(errorLogContent)), 3000);

// packages
const packagePath = path.join(__dirname, '../../package.json');

// xprofiler log
const xprofilerLogContent = path.join(__dirname, './files/xprofiler');
const xprofilerLogDir = path.join(__dirname, './files/');
const xprofilerLogPath = path.join(__dirname, './files/', `xprofiler-${moment().format('YYYYMMDD')}.log`);
if (!fs.existsSync(xprofilerLogPath)) {
  fs.writeFileSync(xprofilerLogPath, '');
}
setTimeout(() => fs.writeFileSync(xprofilerLogPath, fs.readFileSync(xprofilerLogContent)), 3000);

let clientReconnectCount = 0;

function send(msg) {
  if (typeof process.send === 'function') {
    process.send(msg);
  }
}

xtransit.start({
  server: process.env.UNIT_TEST_TRANSIT_CLIENT_SERVER,
  appId: process.env.UNIT_TEST_TRANSIT_APP_ID,
  appSecret: process.env.UNIT_TEST_TRANSIT_APP_SECRET,
  reconnectBaseTime: process.env.UNIT_TEST_TRANSIT_CLIENT_RECONNECT_TIME,
  heartbeatInterval: process.env.UNIT_TEST_TRANSIT_HEARTBEAT_INTERVAL,
  logLevel: process.env.UNIT_TEST_TRANSIT_LOG_LEVEL,
  docker: process.env.UNIT_TEST_TRANSIT_IP_MODE === 'YES' ? true : undefined,
  ipMode: process.env.UNIT_TEST_TRANSIT_IP_MODE === 'YES' ? true : undefined,
  libMode: process.env.UNIT_TEST_TRANSIT_LIB_MODE === 'YES' ? true : undefined,
  errors: process.env.UNIT_TEST_TRANSIT_ERRORS ? [errorLogPath] : undefined,
  packages: process.env.UNIT_TEST_TRANSIT_PACKAGES ? [packagePath] : undefined,
  logdir: xprofilerLogDir,
  lookup: async server => {
    clientReconnectCount++;
    send({ ok: true, type: 'client_reconnect_count', data: { clientReconnectCount } });
    console.log('[transit-client] wait for server lookup...');
    return await new Promise(resolve => setTimeout(() => resolve(server), 10));
  },
});

function close() {
  if (fs.existsSync(errorLogPath)) {
    fs.unlinkSync(errorLogPath);
  }
  if (fs.existsSync(xprofilerLogPath)) {
    fs.unlinkSync(xprofilerLogPath);
  }
  process.exit(0);
}

// expired time
const runningTime = process.env.UNIT_TEST_TRANSIT_CLIENT_RUNNING_TIME;
if (runningTime && !isNaN(runningTime)) {
  setTimeout(close, runningTime);
}

// wait for close
process.on('message', msg => {
  if (msg === 'close') {
    close();
  }
});
