'use strict';

const cp = require('child_process');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const mm = require('mm');
const expect = require('expect.js');
const Agent = require('../lib/agent');
const messageHandler = require('../lib/handler');

function getError(config) {
  let error;
  try {
    new Agent(config);
  } catch (err) {
    error = err.message;
  }
  return error;
}

describe('get config', function() {
  afterEach(mm.restore);

  it('should throw error', function() {
    expect(getError({})).to.be('config.server must be passed in!');
    expect(getError({ server: 'mock' })).to.be('config.server must be passed in!');
    expect(getError({ server: 'ws://127.0.0.1' })).to.be('config.appId must be passed in!');
    expect(getError({ server: 'ws://127.0.0.1', appId: 1 })).to.be('config.appSecret must be passed in!');
  });

  it('should have default value', function() {
    const agent = new Agent({ server: 'ws://127.0.0.1', appId: 1, appSecret: 'test' });
    expect(agent.logdir).to.be(os.tmpdir());
    expect(agent.logLevel).to.be(2);
    expect(String(agent.errexp)).to.be(String(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i));
    expect(agent.reconnectBaseTime).to.be(60);
    expect(agent.heartbeatInterval).to.be(60);
    expect(agent.docker).to.be(false);
    expect(agent.ipMode).to.be(false);
    expect(agent.libMode).to.be(false);
    expect(agent.cleanAfterUpload).to.be(false);
    expect(Array.isArray(agent.disks)).to.be(true);
    expect(agent.disks.length).to.be(0);
    expect(Array.isArray(agent.errors)).to.be(true);
    expect(agent.errors.length).to.be(0);
    expect(Array.isArray(agent.packages)).to.be(true);
    expect(agent.packages.length).to.be(0);
    expect(Array.isArray(agent.titles)).to.be(true);
    expect(agent.titles.length).to.be(0);
  });

  it('shoule merge user config', function() {
    const logdir = path.resolve('/path/to/xprofiler');
    const logLevel = 3;
    const errexp = /Error: /;
    const reconnectBaseTime = 30;
    const heartbeatInterval = 30;
    const docker = true;
    const ipMode = true;
    const libMode = true;
    const cleanAfterUpload = true;
    const disks = ['/', '/', '/test'];
    const errors = ['/error.log', '/error.log', '/error.log'];
    const packages = ['/package.json', '/package.json', '/package.json'];
    const titles = ['mock-node'];
    const agent = new Agent({
      server: 'ws://127.0.0.1',
      appId: 1,
      appSecret: 'test',
      logdir,
      logLevel,
      errexp,
      reconnectBaseTime,
      heartbeatInterval,
      docker,
      ipMode,
      libMode,
      cleanAfterUpload,
      disks,
      errors,
      packages,
      titles,
    });
    expect(agent.logdir).to.be(logdir);
    expect(agent.logLevel).to.be(logLevel);
    expect(String(agent.errexp)).to.be(String(errexp));
    expect(agent.reconnectBaseTime).to.be(reconnectBaseTime);
    expect(agent.heartbeatInterval).to.be(heartbeatInterval);
    expect(agent.docker).to.be(docker);
    expect(agent.ipMode).to.be(ipMode);
    expect(agent.libMode).to.be(libMode);
    expect(agent.cleanAfterUpload).to.be(cleanAfterUpload);
    expect(Array.isArray(agent.disks)).to.be(true);
    expect(agent.disks.length).to.be(Array.from(new Set(disks)).length);
    expect(Array.isArray(agent.errors)).to.be(true);
    expect(agent.errors.length).to.be(Array.from(new Set(errors)).length);
    expect(Array.isArray(agent.packages)).to.be(true);
    expect(agent.packages.length).to.be(Array.from(new Set(packages)).length);
    expect(Array.isArray(agent.titles)).to.be(true);
    expect(agent.titles.length).to.be(Array.from(new Set(titles)).length);
  });

  it('should config logDir', function() {
    const logDir = path.resolve('/path/to/xprofiler');
    const agent = new Agent({
      server: 'ws://127.0.0.1',
      appId: 1,
      appSecret: 'test',
      logDir,
    });
    expect(agent.logdir).to.be(logDir);
  });

  it('shoule use config.nodeExe', async function() {
    const logdir = path.resolve('/path/to/xprofiler');
    const logLevel = 3;
    const errexp = /Error: /;
    const reconnectBaseTime = 30;
    const heartbeatInterval = 30;
    const docker = true;
    const ipMode = true;
    const libMode = true;
    const cleanAfterUpload = true;
    const disks = ['/', '/', '/test'];
    const errors = ['/error.log', '/error.log', '/error.log'];
    const packages = ['/package.json', '/package.json', '/package.json'];
    const titles = ['mock-node'];
    const agent = new Agent({
      nodeExe: 'foo',
      server: 'ws://127.0.0.1',
      appId: 1,
      appSecret: 'test',
      logdir,
      logLevel,
      errexp,
      reconnectBaseTime,
      heartbeatInterval,
      docker,
      ipMode,
      libMode,
      cleanAfterUpload,
      disks,
      errors,
      packages,
      titles,
    });
    let execOptions;
    let exeFile;
    mm(cp, 'execFile', (file, args, options, cb) => {
      execOptions = options;
      exeFile = file;
      cb(null, {
        stdout: 'succeed',
        stderr: null,
      });
    });
    const execFile = promisify(cp.execFile);
    await messageHandler.call(agent, JSON.stringify({
      traceId: 'mock_trace_id',
      type: 'exec_command',
      data: {
        command: 'check_process_status 2',
      },
    }), {
      execFile,
    });
    expect(exeFile).to.be('foo');
    expect(execOptions.env.XTRANSIT_NODE_EXE).to.be('foo');
  });
});
