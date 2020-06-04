'use strict';

const cp = require('child_process');
const path = require('path');
const expect = require('expect.js');
const xtransit = require('../xtransit');
const { sleep } = require('../common/utils');
const transitServer = path.join(__dirname, 'fixtures/transit-server.js');
const transitClient = path.join(__dirname, 'fixtures/transit-client.js');

describe('running xtransit', function() {
  it('should throw if config.server is null', function() {
    let error = null;
    try {
      xtransit.start({ server: null });
    } catch (err) {
      error = err.message;
    }
    expect(error).to.be('config.server must be passed in!');
  });

  it('should throw if config.appId is null', function() {
    let error = null;
    try {
      xtransit.start({ server: 'ws://127.0.0.1:9090' });
    } catch (err) {
      error = err.message;
    }
    expect(error).to.be('config.appId must be passed in!');
  });

  it('should throw if config.appSecret is null', function() {
    let error = null;
    try {
      xtransit.start({ server: 'ws://127.0.0.1:9090', appId: 5 });
    } catch (err) {
      error = err.message;
    }
    expect(error).to.be('config.appSecret must be passed in!');
  });
});

describe('running xtransit', function() {
  const port = 9091;
  let xserver = null;
  let xclient = null;
  // data
  let clientCount = null;

  async function startServer() {
    xserver = cp.fork(transitServer, {
      env: Object.assign({}, process.env, {
        UNIT_TEST_TRANSIT_SERVER_PORT: port,
        UNIT_TEST_TRANSIT_SERVER_RUNNING_TIME: 15000,
      }),
    });
    // wait for server opened
    await new Promise(resolve => xserver.on('message', msg => {
      if (msg === 'opened') {
        resolve();
      } else {
        const { type, data } = msg;
        switch (type) {
          case 'new_client_count':
            clientCount = data.clientCount;
            break;
          default:
            console.log(`unknown ${type}: ${JSON.stringify(data)}`);
        }
      }
    }));
  }

  before(async function() {
    // start xserver
    await startServer();

    // start xtransit client
    xclient = cp.fork(transitClient, {
      env: Object.assign({}, process.env, {
        UNIT_TEST_TRANSIT_CLIENT_SERVER: `ws://127.0.0.1:${port}`,
        UNIT_TEST_TRANSIT_APP_ID: 1,
        UNIT_TEST_TRANSIT_APP_SECRET: 'mock',
        UNIT_TEST_TRANSIT_CLIENT_RECONNECT_TIME: 1,
        UNIT_TEST_TRANSIT_HEARTBEAT_INTERVAL: 1,
        UNIT_TEST_TRANSIT_LOG_LEVEL: 2,
        UNIT_TEST_TRANSIT_CLIENT_RUNNING_TIME: 15000,
        UNIT_TEST_TRANSIT_LOG_INTERVAL: 2,
      }),
    });
    await sleep(5000);
  });

  after(() => {
    xserver.send('close');
    xserver = null;
    xclient.send('close');
    xclient = null;
  });

  it('should run as expected.', function() {
    expect(clientCount).to.be(1);
  });

  it('should reconnected as expected.', async function() {
    xserver.send('close');
    await sleep(3000);
    await startServer();
    await sleep(1500);
    expect(clientCount).to.be(1);
  });

  it('should connect failed with wss', async function() {
    const xclient2 = cp.fork(transitClient, {
      env: Object.assign({}, process.env, {
        UNIT_TEST_TRANSIT_CLIENT_SERVER: `wss://localhost:${port}`,
        UNIT_TEST_TRANSIT_APP_ID: 1,
        UNIT_TEST_TRANSIT_APP_SECRET: 'mock',
        UNIT_TEST_TRANSIT_CLIENT_RUNNING_TIME: 15000,
      }),
    });
    await sleep(500);
    expect(clientCount).to.be(1);
    xclient2.send('close');
  });
});
