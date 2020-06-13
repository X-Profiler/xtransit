'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const pMap = require('p-map');
const moment = require('moment');
const exists = promisify(fs.exists);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const { isNumber, checkAlive } = require('../common/utils');

const KEEP_DAYS = 7;
const INFO_PATT = /^(xprofiler)-(\d{8})\.log$/;
const ERROR_PATT = /^(xprofiler-error)-(\d{8})\.log$/;
const DEBUG_PATT = /^(xprofiler-debug)-(\d{8})\.log$/;
const SOCKET_PATT = /^(xprofiler-uds-path)-(\d+)\.sock$/;

let logger;

async function cleanLogs(logdir) {
  if (!await exists(logdir)) {
    return logger.error(`${logdir} not exists`);
  }

  const today = moment();
  const files = await readdir(logdir);

  // logs will clean
  const logs = files.filter(fileName => {
    const matched = fileName.match(INFO_PATT)
      || fileName.match(ERROR_PATT)
      || fileName.match(DEBUG_PATT);

    if (!matched) {
      return false;
    }

    const pass = moment(matched[2]);
    const diff = today.diff((pass), 'days');
    return diff >= KEEP_DAYS;
  });

  // domain sockets will clean
  const sockets = files.filter(fileName => {
    const matched = fileName.match(SOCKET_PATT);

    if (!matched) {
      return false;
    }

    const pid = parseInt(matched[2]);
    return !isNumber(pid) || !checkAlive(pid);
  });

  const cleanFiles = [
    ...logs,
    ...sockets,
  ];

  await pMap(cleanFiles, async fileName => {
    const filePath = path.join(logdir, fileName);
    /* istanbul ignore next */
    if (!await exists(filePath)) {
      return;
    }
    await unlink(filePath);
  }, { concurrency: 2 });
}

exports = module.exports = async function() {
  const logdir = this.logdir;
  await cleanLogs(logdir);
};

exports.init = async function() {
  logger = this.logger;
};

exports.interval = 24 * 60 * 60;

exports.KEEP_DAYS = KEEP_DAYS;
exports.INFO_PATT = INFO_PATT;
exports.ERROR_PATT = ERROR_PATT;
exports.DEBUG_PATT = DEBUG_PATT;
exports.SOCKET_PATT = SOCKET_PATT;
