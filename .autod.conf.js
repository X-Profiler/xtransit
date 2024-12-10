'use strict';

module.exports = {
  write: true,
  prefix: '^',
  test: [
    'test',
  ],
  dep: [
    'formstream',
    'moment',
    'nounou',
    'p-map',
    'split2',
    'through2',
    'urllib',
    'uuid',
    'ws',
  ],
  devdep: [
    'autod',
    'codecov',
    'eslint',
    'eslint-config-egg',
    'expect.js',
    'mocha',
    'nodemon',
    'nyc'
  ],
  exclude: [
    './scripts',
    './test/fixtures',
    './demo.js',
  ],
  semver: [
    'eslint@6',
    'mocha@7'
  ]
};
