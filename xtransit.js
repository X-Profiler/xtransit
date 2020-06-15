'use strict';

const XtransitAgent = require('./lib/agent');

function start(config) {
  const xtransitAgent = new XtransitAgent(config);
  xtransitAgent.run();
}

exports.start = start;
