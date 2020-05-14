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
