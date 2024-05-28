'use strict';

const utils = require('../common/utils');
const assert = require('assert');
const mm = require('mm');
const os = require('os');

describe('utils.test.js', function () {
  afterEach(mm.restore);

  describe('get xprofiler path', () => {
    it('should work with XPROFILER_PREFIX', () => {
      mm(process.env, 'XPROFILER_PREFIX', '/tmp');
      const p = utils.getXprofilerPath();
      assert.equal(p, '/tmp/.xprofiler');
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx'
      });
      const p = utils.getXprofilerPath();
      assert.equal(p, '/home/xxx/.xprofiler');
    });
  });

  describe('get xtransit path', () => {
    it('should work with XTRANSIT_PREFIX', () => {
      mm(process.env, 'XTRANSIT_PREFIX', '/tmp');
      const p = utils.getXtransitPath();
      assert.equal(p, '/tmp/.xtransit');
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx'
      });
      const p = utils.getXtransitPath();
      assert.equal(p, '/home/xxx/.xtransit');
    });
  });

  describe('get xtransit log path', () => {
    it('should work with XTRANSIT_PREFIX', () => {
      mm(process.env, 'XTRANSIT_PREFIX', '/tmp');
      const p = utils.getXtransitLogPath();
      assert.equal(p, '/tmp/.xtransit.log');
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx'
      });
      const p = utils.getXtransitLogPath();
      assert.equal(p, '/home/xxx/.xtransit.log');
    });
  });
});
