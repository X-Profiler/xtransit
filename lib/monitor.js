'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const { isFunction } = require('../common/utils');

let intervals = [];

async function upload(handle) {
  try {
    const data = await handle.call(this);
    if (!data) {
      return;
    }
    this.sendMessage('log', data);
  } catch (err) /* istanbul ignore next */ {
    this.logger.error(err);
  }
}

exports = module.exports = async function() {
  exports.clearMonitor();

  const orderPath = path.join(__dirname, '../orders');
  const orders = await readdir(orderPath);
  const tasks = [];
  for (const order of orders) {
    const file = path.join(orderPath, order);
    const handle = require(file);
    /* istanbul ignore next */
    if (!isFunction(handle)) {
      continue;
    }
    isFunction(handle.init) && await handle.init.call(this);
    tasks.push(upload.call(this, handle));
    intervals.push(setInterval(upload.bind(this, handle), handle.interval * 1000));
  }

  await Promise.all(tasks);
};

exports.clearMonitor = function() {
  for (const interval of intervals) {
    clearInterval(interval);
  }
  intervals = [];
};
