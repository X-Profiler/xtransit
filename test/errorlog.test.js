'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const expect = require('expect.js');
const errorLogLib = require('../orders/error_log');
const baseContext = require('./fixtures/context');
const { getErrorText, setErrorText } = baseContext;

describe('get error logs', function() {
  const errors = [];
  const context = Object.assign({}, baseContext, { errors });

  before(async function() {
    await errorLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should get empty errors', async function() {
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(0);
  });
});

describe('get error logs', function() {
  const errorFile = path.join(__dirname, 'fixtures/errorlog2');
  const errors = [errorFile];

  const context = Object.assign({}, baseContext, { errors });
  before(async function() {
    await errorLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
  });

  it('should get empty errors', async function() {
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(0);
  });
});

describe('get error logs', function() {
  const errorFile = path.join(__dirname, 'fixtures/errorlog1');
  const errors = [errorFile];

  const context = Object.assign({}, baseContext, { errors });
  before(async function() {
    if (!await exists(errorFile)) {
      await mkdir(errorFile, { recursive: true });
    }
    await errorLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
    await rmdir(errorFile);
  });

  it('should get empty errors', async function() {
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(1);
    expect(Object.keys(message.data[errorFile]).length).to.be(0);
    expect(getErrorText().includes('getAdditionalLogs failed')).to.be.ok();
  });
});

describe('get error logs', function() {
  const errorFile = path.join(__dirname, 'fixtures/errorlog/common-error.log');
  const errors = [errorFile];

  const context = Object.assign({}, baseContext, {
    errors,
    errexp: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i,
  });
  before(async function() {
    const dir = path.dirname(errorFile);
    if (!await exists(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(errorFile, 'mock error\n');

    await errorLogLib.init.call(context);
  });

  after(async function() {
    setErrorText('');
    await unlink(errorFile);
    await rmdir(path.dirname(errorFile));
  });

  it('should get empty error at first', async function() {
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(1);
    expect(Object.keys(message.data[errorFile]).length).to.be(0);
  });

  it('should get get empty error when errexp not matched', async function() {
    await writeFile(errorFile, 'mock error\n', { flag: 'a' });
    await writeFile(errorFile, 'mock error\n', { flag: 'a' });
    await writeFile(errorFile, 'mock error\n', { flag: 'a' });
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(1);
    expect(Object.keys(message.data[errorFile]).length).to.be(0);
  });

  it('should get get errors when errexp matched', async function() {
    await writeFile(errorFile, '[2020-06-03 22:30:41,912] mock error1\n', { flag: 'a' });
    await writeFile(errorFile, '[2020-06-03 22:30:41,912] mock error2\n', { flag: 'a' });
    await writeFile(errorFile, '[2020-06-03 22:30:41,912] mock error3\n', { flag: 'a' });
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(1);
    expect(Object.keys(message.data[errorFile]).length).to.be(2);
  });

  it('should get get errors when error file reseted', async function() {
    await writeFile(errorFile, '[2020-06-05 22:30:41,912] mock error4\n');
    await writeFile(errorFile, '[2020-06-05 22:30:41,912] mock error5\n', { flag: 'a' });
    await writeFile(errorFile, '[2020-06-05 22:30:41,912] mock error6\n', { flag: 'a' });
    const message = await errorLogLib.call(context);
    expect(message.type).to.be('error_log');
    expect(Object.keys(message.data).length).to.be(1);
    expect(Object.keys(message.data[errorFile]).length).to.be(3);
  });
});
