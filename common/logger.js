/* istanbul ignore file */
'use strict';

const moment = require('moment');
const pkg = require('../package.json');

const [ERROR, INFO, WARN, DEBUG] = [0, 1, 2, 3];

class Logger {
  constructor(level) {
    this.level = level;
  }

  static get levels() {
    return {
      ERROR,
      INFO,
      WARN,
      DEBUG,
    };
  }

  getPrefix(level) {
    return `[${moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')}] [${pkg.version}] [${level}] [${process.pid}]`;
  }

  error(msg) {
    if (this.level >= ERROR) {
      console.error(`${this.getPrefix('error')} ${msg}`);
    }
  }

  info(msg) {
    if (this.level >= INFO) {
      console.log(`${this.getPrefix('info')} ${msg}`);
    }
  }

  warn(msg) {
    if (this.level >= WARN) {
      console.log(`${this.getPrefix('warn')} ${msg}`);
    }
  }

  debug(msg) {
    if (this.level >= DEBUG) {
      console.log(`${this.getPrefix('debug')} ${msg}`);
    }
  }
}

module.exports = Logger;
