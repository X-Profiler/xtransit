'use strict';

const configure = require('./config');
const XtransitAgent = require('./lib/agent');

async function start() {
  const config = await configure();
  const xtransitAgent = new XtransitAgent(config);
  xtransitAgent.run();
}

exports.start = start;