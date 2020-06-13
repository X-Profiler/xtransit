/* istanbul ignore file */
'use strict';

const moment = require('moment');
const pkg = require('../package.json');

class Logger {
  constructor(level) {
    this.level = level;
  }

  getPrefix(level) {
    return `[${moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')}] [${pkg.version}] [${level}] [${process.pid}]`;
  }

  error(msg) {
    if (this.level >= 0) {
      console.error(`${this.getPrefix('error')} ${msg}`);
    }
  }

  info(msg) {
    if (this.level >= 1) {
      console.log(`${this.getPrefix('info')} ${msg}`);
    }
  }

  warn(msg) {
    if (this.level >= 2) {
      console.log(`${this.getPrefix('warn')} ${msg}`);
    }
  }

  debug(msg) {
    if (this.level >= 3) {
      console.log(`${this.getPrefix('debug')} ${msg}`);
    }
  }
}

module.exports = Logger;
