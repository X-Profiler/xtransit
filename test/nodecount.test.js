'use strict';

const path = require('path');
const expect = require('expect.js');
const {
  getNodeCount,
} = require('../orders/system_log');

describe('get node count correct', function() {
  it('should run ok', async function() {
    let count,
      err;
    try {
      count = await getNodeCount();
    } catch (e) {
      err = e;
    }
    expect(err).not.to.be.ok();
    expect(count).to.be.ok();
  });

  it('should run ok with space', async function() {
    let count,
      err;
    try {
      count = await getNodeCount([], path.join(__dirname, 'fixtures/with space/get_node_processes.js'));
    } catch (e) {
      err = e;
    }
    expect(err).not.to.be.ok();
    expect(count).to.be.ok();
  });
});
