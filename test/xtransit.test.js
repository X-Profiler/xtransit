'use strict';

const expect = require('expect.js');
const xtransit = require('../xtransit');

describe('xtransit should run as expected.', function () {
  it('should be ok', function () {
    expect(xtransit).to.be.ok();
  });
});