'use strict';

const fs = require('node:fs');
const path = require('node:path');
const expect = require('expect.js');
const ErrorParser = require('../common/error');
const errorFilePath = path.join(__dirname, './fixtures/files/error');
const { map, parsers, MAX_READABLE_SIZE, MAX_ERROR_COUNT, readFileAsStream } = require('../orders/error_log');
const bigError = fs.readFileSync(path.join(__dirname, './fixtures/files/big-error'), 'utf-8');

describe('parse error logs', function() {
  const parser = new ErrorParser(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i, 5);
  const readable = fs.createReadStream(errorFilePath);
  let logs = [];

  before(async function() {
    logs = await parser.parseStream(readable);
  });

  it('should parse ok', function() {
    expect(logs.length).to.be.ok();
  });

  it('should limit 5 error log', function() {
    expect(logs.length).to.be(5);
  });
});

describe('parse error logs', function() {
  const parser = new ErrorParser(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i, 0);
  const readable = fs.createReadStream(errorFilePath);
  let logs = [];

  before(async function() {
    logs = await parser.parseStream(readable);
  });

  it('should have 9 error logs', function() {
    expect(logs.length).to.be.ok();
    expect(logs.length).to.be(12);
  });
});

describe('parse error logs', function() {
  let start = 0;
  let logs = [];
  const tmpErrorPath = path.join(__dirname, './fixtures/tmp-error');

  before(async function() {
    fs.writeFileSync(tmpErrorPath, bigError);
    parsers.set(tmpErrorPath, new ErrorParser(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i, MAX_ERROR_COUNT));
    logs = await readFileAsStream(tmpErrorPath, start);
  });

  after(function() {
    fs.unlinkSync(tmpErrorPath);
    map.delete(tmpErrorPath);
    parsers.delete(tmpErrorPath);
  });

  it('should have error logs', async function() {
    expect(logs.length).to.be(1);

    // add 10 big log
    start = map.get(tmpErrorPath);
    for (let i = 0; i < 10; i++) {
      fs.appendFileSync(tmpErrorPath, bigError);
    }
    logs = await readFileAsStream(tmpErrorPath, start);
    expect(logs.length).to.be(10);

    // add 10000 big log
    const count = 10000;
    console.time(`append ${count} big error log`);
    start = map.get(tmpErrorPath);
    for (let i = 0; i < count; i++) {
      fs.appendFileSync(tmpErrorPath, bigError);
    }
    console.timeEnd(`append ${count} big error log`);
    console.time(`parse ${count} big error log`);
    logs = await readFileAsStream(tmpErrorPath, start);
    console.log(`new error log size: ${bigError.length * count}, readable limit: ${MAX_READABLE_SIZE} (error log ${bigError.length * 100 > MAX_READABLE_SIZE ? '>' : '<'} readable limit)`);
    console.timeEnd(`parse ${count} big error log`);
    expect(logs.length).to.be(parseInt(MAX_READABLE_SIZE / bigError.length));

    // add 10 big log
    start = map.get(tmpErrorPath);
    for (let i = 0; i < 10; i++) {
      fs.appendFileSync(tmpErrorPath, bigError);
    }
    logs = await readFileAsStream(tmpErrorPath, start);
    expect(logs.length).to.be(10);
  });
});
