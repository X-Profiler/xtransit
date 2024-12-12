'use strict';

const path = require('node:path');
const cp = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(cp.exec);
const expect = require('expect.js');
const { sleep } = require('../common/utils');
const getNodeProcesses = path.join(__dirname, '../commands/get_node_processes.js');

const customTitle = 'EZM3';
const customNodePath = path.join(__dirname, './fixtures/custom-process.js');

describe('filter node processes', function() {
  let proc;

  before(async () => {
    proc = cp.spawn('node', [customNodePath], {
      env: Object.assign({}, process.env, {
        UNIT_TEST_TRANSIT_TITLE: customTitle,
      }),
    });

    await sleep(2000);
  });

  after(async () => {
    proc.kill();
    await sleep(1000);
  });

  it('should get custom process', async function() {
    const { stdout } = await exec(`node ${getNodeProcesses}`, {
      env: Object.assign({}, process.env, {
        XTRANSIT_TITLES: JSON.stringify([customTitle]),
      }),
    });
    const processes = stdout.toString().split('\n');
    expect(processes.some(process => Number(process.split('\u0000')[0]) === proc.pid)).to.be(true);
  });
});
