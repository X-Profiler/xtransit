'use strict';

const fs = require('fs');
const path = require('path');
const through = require('through2');
const split = require('split2');
const { promisify } = require('util');
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const moment = require('moment');

const MAX_LOG_LINES = 500;
const map = new Map();
const FILE_RECORD_KEY = Symbol('XTRANSIT::CURRENT_FILE');
const PERFORMANCE_LOG_TYPE = ['cpu', 'memory', 'gc', 'uv', 'http'];

let logger;

const patt = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(.+)\] \[(.+)\] \[(\d+)\] \[(\d{1,3}\.\d{1,3}\.\d{1,3}.*)\] (.*)/g;
const reg = /([^\s]*): (\d+(\.\d{0,2})?)/g;

function formatLogs(logs) {
  let matched;
  const data = { logs: [], xprofiler_version: '', log_time: moment().format('YYYY-MM-DD HH:mm:ss'), log_timestamp: Date.now() };
  for (const log of logs) {
    while ((matched = patt.exec(log)) !== null) {
      const [, , level, type, pid, version, detail] = matched;
      if (level !== 'info') {
        continue;
      }
      if (!PERFORMANCE_LOG_TYPE.includes(type)) {
        continue;
      }
      // data.log_time = time;
      data.xprofiler_version = version;
      let pair;
      while ((pair = reg.exec(detail)) !== null) {
        const [, key, value] = pair;
        data.logs.push({
          pid: Number(pid),
          key,
          value: parseFloat(value),
        });
      }
    }
  }
  return data;
}

function getCurrentXprofilerLog(logdir) {
  return path.join(logdir, 'xprofiler-' + moment().format('YYYYMMDD') + '.log');
}

function readFileAsStream(filepath, start) {
  return new Promise((resolve, reject) => {
    const buffered = [];
    const readable = fs.createReadStream(filepath, { start });

    readable.pipe(split()).pipe(through((line, _, next) => {
      /* istanbul ignore else */
      if (line.length) {
        buffered.push(line);
        if (buffered.length > MAX_LOG_LINES) {
          buffered.shift();
        }
      }
      next();
    }));

    readable.on('data', data => (start += data.length));

    /* istanbul ignore next */
    readable.on('error', err => {
      reject(err);
      readable.destroy();
    });

    readable.on('end', () => {
      map.set(filepath, start);
      resolve(buffered.join('\n'));
    });
  });
}

async function getAdditionalLogs(filepath) {
  try {
    if (!await exists(filepath)) {
      return null;
    }

    const stats = await stat(filepath);
    if (!stats.isFile()) {
      return null;
    }

    const start = map.get(filepath) || /* istanbul ignore next */ 0;
    if (stats.size === start) {
      return null;
    }

    return await readFileAsStream(filepath, start);
  } catch (err) /* istanbul ignore next */ {
    logger.error(`getAdditionalLogs failed: ${err.stack}`);
    return null;
  }
}

function readLogs(logdir) {
  const currentPath = getCurrentXprofilerLog(logdir);
  const lastPath = map.get(FILE_RECORD_KEY);
  const tasks = [];
  /* istanbul ignore if */
  if (currentPath !== lastPath) {
    map.set(FILE_RECORD_KEY, currentPath);
    tasks.push(getAdditionalLogs(lastPath));
    tasks.push(getAdditionalLogs(currentPath));
  } else {
    tasks.push(getAdditionalLogs(currentPath));
  }
  return Promise.all(tasks);
}

exports = module.exports = async function() {
  const logdir = this.logdir;
  const logs = (await readLogs(logdir)).filter(log => log);
  const message = {
    type: 'xprofiler_log',
    data: formatLogs(logs),
    lines: process.env.UNIT_TEST && logs[0] ? logs[0].split('\n').length : 0,
  };
  return message;
};

exports.init = async function() {
  logger = this.logger;
  const logdir = this.logdir;
  const currentPath = getCurrentXprofilerLog(logdir);
  map.set(FILE_RECORD_KEY, currentPath);
  if (await exists(currentPath)) {
    const logFileStat = await stat(currentPath);
    map.set(currentPath, logFileStat.size);
  }
};

exports.interval = process.env.UNIT_TEST_TRANSIT_LOG_INTERVAL || 60;

exports.MAX_LOG_LINES = MAX_LOG_LINES;
