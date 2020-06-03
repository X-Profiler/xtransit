'use strict';

const { checkAlive } = require('../common/utils');
const pids = process.argv.slice(2);

const result = {};
for (const pid of pids) {
  result[pid] = !!checkAlive(pid);
}

console.log(JSON.stringify(result));
