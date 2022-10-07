'use strict';

const fs = require('fs');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const exists = promisify(fs.exists);
const Parser = require('../common/error');

const MAX_ERROR_COUNT = 50;
const MAX_READABLE_SIZE = 10 * 1024 * 1024;

const map = new Map();
const parsers = new Map();

let logger;

function readFileAsStream(errorLog, start) {
  const end = start + MAX_READABLE_SIZE;
  const readable = fs.createReadStream(errorLog, {
    start,
    end,
    encoding: 'utf8',
  });

  readable.on('data', function(data) {
    start += Buffer.byteLength(data);
  });

  readable.on('end', function() {
    if (start < end) {
      map.set(errorLog, start);
    } else {
      const size = (fs.statSync(errorLog)).size;
      map.set(errorLog, size);
    }
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

exports.readFileAsStream = readFileAsStream;

exports.MAX_ERROR_COUNT = MAX_ERROR_COUNT;

exports.MAX_READABLE_SIZE = MAX_READABLE_SIZE;

exports.map = map;

exports.parsers = parsers;
