'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const expect = require('expect.js');
const moment = require('moment');
const xprofilerLogLib = require('../orders/xprofiler_log');
const baseContext = require('./fixtures/context');
const { setErrorText } = baseContext;

const { MAX_LOG_LINES } = xprofilerLogLib;

async function unlinkDir(dir) {
  if (!await exists(dir)) {
    return;
  }

  for (const file of await readdir(dir)) {
    const filePath = path.join(dir, file);
    if (!await exists(filePath)) {
      continue;
    }
    const stats = await stat(filePath);
    if (stats.isFile()) {
      await unlink(filePath);
    } else {
      await rmdir(filePath);
    }
  }

  await rmdir(dir);
}

async function createXprofilerLog(dir, create = true, createDir = false) {
  if (!await exists(dir)) {
    await mkdir(dir, { recursive: true });
  }

  if (create) {
    const xprofilerLog = path.join(dir, `xprofiler-${moment().format('YYYYMMDD')}.log`);
    await writeFile(xprofilerLog, 'mock\n');
    return xprofilerLog;
  }

  if (createDir) {
    const xprofilerLog = path.join(dir, `xprofiler-${moment().format('YYYYMMDD')}.log`);
    await mkdir(xprofilerLog, { recursive: true });
  }
}

describe('get xprofiler logs', function() {
  const logdir = path.join(__dirname, 'fixtures/xprofiler1');
  let context = {};

  before(async function() {
    context = Object.assign({}, baseContext, { logdir });
    await xprofilerLogLib.init.call(context);
    process.env.UNIT_TEST = true;
  });

  after(async function() {
    setErrorText('');
    await unlinkDir(logdir);
    process.env.UNIT_TEST = undefined;
  });

  it('should get empty xprofiler logs', async function() {
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.logs.length).to.be(0);
  });
});

describe('get xprofiler logs', function() {
  const logdir = path.join(__dirname, 'fixtures/xprofiler2');
  let context = {};

  before(async function() {
    await createXprofilerLog(logdir, false);
    context = Object.assign({}, baseContext, { logdir });
    await xprofilerLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
    await unlinkDir(logdir);
  });

  it('should get empty xprofiler logs', async function() {
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.logs.length).to.be(0);
  });
});

describe('get xprofiler logs', function() {
  const logdir = path.join(__dirname, 'fixtures/xprofiler3');
  let context = {};

  before(async function() {
    await createXprofilerLog(logdir, false, true);
    context = Object.assign({}, baseContext, { logdir });
    await xprofilerLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
    await unlinkDir(logdir);
  });

  it('should get empty xprofiler logs', async function() {
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.logs.length).to.be(0);
  });
});

describe('get xprofiler logs', function() {
  const logdir = path.join(__dirname, 'fixtures/xprofiler');
  let xprofilerLog = '';
  let context = {};

  before(async function() {
    xprofilerLog = await createXprofilerLog(logdir);
    context = Object.assign({}, baseContext, { logdir });
    await xprofilerLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
    await unlinkDir(logdir);
  });

  it('should get empty xprofiler logs', async function() {
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.logs.length).to.be(0);
  });

  it('should get empty xprofiler logs with incorrect line', async function() {
    await writeFile(xprofilerLog, '[2020-06-04 00:32:05] [info2] [cpu] [89159] [0] [2.0.0] cpu_usage(%) cpu_now: 0.000000, cpu_15: 0.000000, cpu_30: 0.000000, cpu_60: 0.042544\n', { flag: 'a' });
    await writeFile(xprofilerLog, '[2020-06-04 00:32:05] [info] [cpu2] [89159] [0] [2.0.0] cpu_usage(%) cpu_now: 0.000000, cpu_15: 0.000000, cpu_30: 0.000000, cpu_60: 0.042544\n', { flag: 'a' });
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.logs.length).to.be(0);
  });

  it('should get xprofiler logs', async function() {
    await writeFile(xprofilerLog, '[2020-06-04 00:32:05] [info] [cpu] [89159] [0] [2.0.0] cpu_usage(%) cpu_now: 0.000000, cpu_15: 0.000000, cpu_30: 0.000000, cpu_60: 0.042544\n', { flag: 'a' });
    const message = await xprofilerLogLib.call(context);
    expect(message.type).to.be('xprofiler_log');
    expect(message.data.xprofiler_version).to.be('2.0.0');
    expect(message.data.logs.length).to.be(4);
  });

  it('should limit log lines', async function() {
    for (let i = 0; i < MAX_LOG_LINES + 50; i++) {
      await writeFile(xprofilerLog, '[2020-06-04 00:32:05] [info] [cpu] [89159] [0] [2.0.0] cpu_usage(%) cpu_now: 0.000000, cpu_15: 0.000000, cpu_30: 0.000000, cpu_60: 0.042544\n', { flag: 'a' });
    }
    const message = await xprofilerLogLib.call(context);
    expect(message.lines).to.be(MAX_LOG_LINES);
  });
});
