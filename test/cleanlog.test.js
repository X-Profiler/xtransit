'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const expect = require('expect.js');
const moment = require('moment');
const cleanLogLib = require('../orders/clean_log');
const baseContext = require('./fixtures/context');
const { getErrorText, setErrorText } = baseContext;

const {
  KEEP_DAYS,
  INFO_PATT,
  ERROR_PATT,
  DEBUG_PATT,
  SOCKET_PATT,
} = cleanLogLib;

const CLEAN = 5;

async function getLogFiles(logdir) {
  const files = [];
  for (const fileName of await readdir(logdir)) {
    const matched = fileName.match(INFO_PATT)
      || fileName.match(ERROR_PATT)
      || fileName.match(DEBUG_PATT);
    if (!matched) {
      continue;
    }
    files.push(path.join(logdir, fileName));
  }
  return files;
}

async function getSockFiles(logdir) {
  const files = [];
  for (const fileName of await readdir(logdir)) {
    const matched = fileName.match(SOCKET_PATT);
    if (!matched) {
      continue;
    }
    files.push(path.join(logdir, fileName));
  }
  return files;
}

describe('clean log', function() {
  const logdir = '/path/not/exisis';
  const context = Object.assign({}, baseContext, { logdir });
  before(async function() {
    await cleanLogLib.init.call(context);
    await cleanLogLib.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should log error when logdir not exists', function() {
    expect(getErrorText()).to.be(`${logdir} not exists`);
  });
});

describe('clean log', function() {
  let logFiles = [];
  const sockFiles = [];
  let context = {};

  before(async function() {
    // create logdir
    const logdir = path.join(__dirname, 'fixtures/cleanlog');
    if (!await exists(logdir)) {
      await mkdir(logdir, { recursive: true });
    }

    logFiles = new Array(KEEP_DAYS + CLEAN).fill('').reduce((...args) => {
      const [files, , index] = args;
      const today = moment();
      const dayFormat = today.subtract(index, 'd').format('YYYYMMDD');
      files.push(
        `xprofiler-${dayFormat}.log`,
        `xprofiler-error-${dayFormat}.log`,
        `xprofiler-debug-${dayFormat}.log`
      );
      return files;
    }, []);

    sockFiles.push(
      'xprofiler-uds-path-123456783333.sock',
      'xprofiler-uds-path-999999995555.sock',
      'xprofiler-uds-path-098712347777.sock'
    );

    for (const file of sockFiles.concat(logFiles)) {
      await writeFile(path.join(logdir, file), 'mock');
    }
    context = Object.assign({}, baseContext, { logdir });

    await cleanLogLib.init.call(context);
  });

  after(async function() {
    for (const file of (await getSockFiles(context.logdir)).concat(await getLogFiles(context.logdir))) {
      if (!await exists(file)) {
        continue;
      }
      await unlink(file);
    }

    await rmdir(context.logdir);

    setErrorText('');
  });

  it('should create files as expected', async function() {
    expect((await getLogFiles(context.logdir)).length).to.be(logFiles.length);
    expect((await getSockFiles(context.logdir)).length).to.be(sockFiles.length);
  });

  it('should clean as expected', async function() {
    await cleanLogLib.call(context);
    expect((await getLogFiles(context.logdir)).length).to.be(KEEP_DAYS * 3);
    expect((await getSockFiles(context.logdir)).length).to.be(0);
  });
});
