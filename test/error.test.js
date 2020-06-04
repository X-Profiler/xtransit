'use strict';

const fs = require('fs');
const path = require('path');
const expect = require('expect.js');
const ErrorParser = require('../common/error');
const errorFilePath = path.join(__dirname, './fixtures/files/error');

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
    expect(logs.length).to.be(9);
  });
});
