'use strict';

const fs = require('fs');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const exists = promisify(fs.exists);
const Parser = require('../common/error');

const MAX_ERROR_COUNT = 50;

const map = new Map();
const parsers = new Map();

let logger;

function readFileAsStream(errorLog, start) {
  const readable = fs.createReadStream(errorLog, {
    start,
    encoding: 'utf8',
  });

  readable.on('data', function(data) {
    start += Buffer.byteLength(data);
  });

  readable.on('end', function() {
    map.set(errorLog, start);
  });

  const parser = parsers.get(errorLog);
  return parser.parseStream(readable);
}

async function getAdditionalLogs(errorLog) {
  try {
    const stats = await stat(errorLog);

    if (!stats.isFile()) {
      throw new Error(`${errorLog} is not a file`);
    }

    let start = map.get(errorLog) || /* istanbul ignore next */ 0;
    if (stats.size === start) {
      return [];
    }

    if (stats.size < start) {
      start = 0;
    }

    return await readFileAsStream(errorLog, start);
  } catch (err) {
    logger.error(`getAdditionalLogs failed: ${err.stack}`);
    return [];
  }
}

async function readLogs(errors) {
  const tasks = [];
  for (const errorLog of errors) {
    if (await exists(errorLog)) {
      tasks.push(getAdditionalLogs(errorLog));
    }
  }
  return Promise.all(tasks);
}

exports = module.exports = async function() {
  const message = {
    type: 'error_log',
    data: {},
  };

  const errors = this.errors;
  if (!errors.length) {
    return message;
  }
  const logs = await readLogs(errors);
  for (let i = 0; i < logs.length; i++) {
    message.data[errors[i]] = logs[i];
  }
  return message;
};

exports.init = async function() {
  logger = this.logger;
  const errors = this.errors;
  for (const errorLog of errors) {
    parsers.set(errorLog, new Parser(this.errexp, MAX_ERROR_COUNT));
    if (await exists(errorLog)) {
      map.set(errorLog, (await stat(errorLog)).size);
    }
  }
};

exports.interval = process.env.UNIT_TEST_TRANSIT_LOG_INTERVAL || 60;

exports.MAX_ERROR_COUNT = MAX_ERROR_COUNT;
