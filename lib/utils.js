'use strict';

const moment = require('moment');

exports.regularWsServer = function (server) {
  return server.startsWith('ws://') || server.startsWith('wss://');
};

exports.formatTime = function (timestamp = Date.now()) {
  return moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

exports.random = function (max, min = 0) {
  return Number(parseFloat(Math.random() * (max - min) + min).toFixed(2));
};