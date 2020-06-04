'use strict';

const os = require('os');

module.exports = () => {
  const config = {};

  config.logdir = os.tmpdir();

  config.logLevel = process.env.XTRANSIT_DEBUG === 'YES' ? 3 : 2;

  return config;
};
