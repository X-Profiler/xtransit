'use strict';

const path = require('node:path');
const utils = require('../common/utils');
const assert = require('node:assert');
const mm = require('mm');
const os = require('node:os');

describe('utils.test.js', function() {
  afterEach(mm.restore);

  describe('get xprofiler path', () => {
    it('should work with XPROFILER_PREFIX', () => {
      mm(process.env, 'XPROFILER_PREFIX', '/tmp');
      const p = utils.getXprofilerPath();
      assert.equal(p, path.normalize('/tmp/.xprofiler'));
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx';
      });
      const p = utils.getXprofilerPath();
      assert.equal(p, path.normalize('/home/xxx/.xprofiler'));
    });
  });

  describe('get xtransit path', () => {
    it('should work with XTRANSIT_PREFIX', () => {
      mm(process.env, 'XTRANSIT_PREFIX', '/tmp');
      const p = utils.getXtransitPath();
      assert.equal(p, path.normalize('/tmp/.xtransit'));
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx';
      });
      const p = utils.getXtransitPath();
      assert.equal(p, path.normalize('/home/xxx/.xtransit'));
    });
  });

  describe('get xtransit log path', () => {
    it('should work with XTRANSIT_PREFIX', () => {
      mm(process.env, 'XTRANSIT_PREFIX', '/tmp');
      const p = utils.getXtransitLogPath();
      assert.equal(p, path.normalize('/tmp/.xtransit.log'));
    });

    it('should work default is home', () => {
      mm(os, 'homedir', () => {
        return '/home/xxx';
      });
      const p = utils.getXtransitLogPath();
      assert.equal(p, path.normalize('/home/xxx/.xtransit.log'));
    });
  });
});
