'use strict';

const os = require('os');
const address = require('address');
const crypto = require('crypto');

exports.regularWsServer = function(server) {
  return server.startsWith('ws://') || server.startsWith('wss://');
};

exports.random = function(max, min = 0) {
  return Number(parseFloat(Math.random() * (max - min) + min).toFixed(2));
};

exports.getAgentId = function() {
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
  if (platform === 'win32') {
    processRegexp = /^(.*) (\d+)$/;
  } else {
    processRegexp = /^(\d+) (.*)$/;
  }

  const parts = processRegexp.exec(proc.trim());
  if (!parts) {
    return result;
  }

  if (platform === 'win32') {
    result.pid = parts[2];
    result.command = parts[1];
  } else {
    result.pid = parts[1];
    result.command = parts[2];
  }

  return result;
};
