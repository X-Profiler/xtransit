'use strict';

const xtransit = require('../../xtransit');

xtransit.start({
  server: process.env.UNIT_TEST_TRANSIT_CLIENT_SERVER,
  appId: process.env.UNIT_TEST_TRANSIT_APP_ID,
  appSecret: process.env.UNIT_TEST_TRANSIT_APP_SECRET,
  reconnectBaseTime: process.env.UNIT_TEST_TRANSIT_CLIENT_RECONNECT_TIME,
  heartbeatInterval: process.env.UNIT_TEST_TRANSIT_HEARTBEAT_INTERVAL,
});

// expired time
const runningTime = process.env.UNIT_TEST_TRANSIT_CLIENT_RUNNING_TIME;
if (runningTime && !isNaN(runningTime)) {
  setTimeout(() => process.exit(0), runningTime);
}

// wait for close
process.on('message', msg => {
  if (msg === 'close') {
    process.exit(0);
  }
});
