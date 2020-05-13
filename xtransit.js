'use strict';

const configure = require('./config');
const XtransitAgent = require('./lib/agent');

function start(userConfig) {
  const defaultConfig = configure();
  const config = Object.assign({}, defaultConfig, userConfig);
  const xtransitAgent = new XtransitAgent(config);
  xtransitAgent.run();
}

exports.start = start;
