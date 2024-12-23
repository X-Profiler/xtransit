'use strict';

const os = require('node:os');
const address = require('address');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const path = require('node:path');

exports.regularWsServer = function(server) {
  return server.startsWith('ws://') || server.startsWith('wss://');
};

exports.random = function(max, min = 0) {
  return Number(parseFloat(Math.random() * (max - min) + min).toFixed(2));
};

exports.getAgentId = function(customAgent, ipMode) {
  if (typeof customAgent === 'function') {
    return customAgent();
  }

  if (!ipMode) {
    return `${os.hostname()}`;
  }
  return `${address.ip()}::${os.hostname()}`;
};

exports.sign = function(message, secret) {
  message = JSON.stringify(message);
  return crypto.createHmac('sha1', secret).update(message).digest('hex');
};

exports.md5 = function(str) {
  const shasum = crypto.createHash('md5');
  shasum.update(str);
  return shasum.digest('hex');
};

exports.isNumber = function(num) {
  return num !== true && num !== false && Boolean(num === 0 || (num && !isNaN(num)));
};

exports.isBoolean = function(bool) {
  return bool === true || bool === false;
};

exports.isFunction = function(func) {
  return typeof func === 'function';
};

exports.checkAlive = function(pid) {
  try {
    return process.kill(pid, 0);
  } catch (ex) {
    return false;
  }
};

exports.getNodeProcessInfo = function(proc, platform) {
  const result = {};

  let processRegexp;

  /* istanbul ignore next */
  if (platform === 'win32') {
    processRegexp = /^(.*) (\d+)$/;
  } else {
    processRegexp = /^(\d+) (.*)$/;
  }

  const parts = processRegexp.exec(proc.trim());
  /* istanbul ignore if */
  if (!parts) {
    return result;
  }

  /* istanbul ignore next */
  if (platform === 'win32') {
    result.pid = parts[2];
    result.command = parts[1];
  } else {
    result.pid = parts[1];
    result.command = parts[2];
  }

  return result;
};

exports.sleep = promisify(setTimeout);

exports.getXtransitPrefix = function() {
  return process.env.XTRANSIT_PREFIX || process.env.XPROFILER_UNIT_TEST_TMP_HOMEDIR || os.homedir();
};

exports.getXprofilePrefix = function() {
  return process.env.XPROFILER_PREFIX || process.env.XPROFILER_UNIT_TEST_TMP_HOMEDIR || os.homedir();
};

exports.getXprofilerPath = function() {
  const prefix = exports.getXprofilePrefix();
  return path.join(prefix, '.xprofiler');
};

exports.getXtransitPath = function() {
  const prefix = exports.getXtransitPrefix();
  return path.join(prefix, '.xtransit');
};

exports.getXtransitLogPath = function() {
  const prefix = exports.getXtransitPrefix();
  return path.join(prefix, '.xtransit.log');
};
