'use strict';

const color = {
  infoConsole(str) {
    return `\x1b[35;1m${str}\x1b[0m`;
  },

  infoConsole2(str) {
    return `\x1b[32;1m${str}\x1b[0m`;
  },

  debugConsole(str) {
    return `\x1b[36;1m${str}\x1b[0m`;
  },

  errorConsole(str) {
    return `\x1b[31;1m${str}\x1b[0m`;
  },

  warnConsole(str) {
    return `\x1b[33;1m${str}\x1b[0m`;
  },

  lineConsole(str) {
    return `\x1b[4;1m${str}\x1b[0m`;
  },
};

module.exports = `
Usage: xtransit [CMD]... [ARGS]

  ${color.infoConsole('-v --version')}           show xtransit version
  ${color.infoConsole('version')}
  ${color.infoConsole('-h --help')}              show this usage
  ${color.infoConsole('help')}
  ${color.infoConsole('list')}                   show running xtransit(s)
  ${color.infoConsole('start config.json')}      start xtransit with config.json
  ${color.infoConsole('stop all')}               stop all running xtransit(s)
  ${color.infoConsole('stop appid')}             stop running xtransit(s) for the appid
`;
