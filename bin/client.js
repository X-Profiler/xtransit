'use strict';

const confPath = process.argv.slice(2)[0];

// exiting with parent process
process.on('disconnect', function() {
  console.log('exiting with parent process');
  process.exit(0);
});

process.on('uncaughtException', function(err) {
  console.log(new Date());
  console.log(err.message);
  console.log(err.stack);
  process.exit(-1);
});

const xtransit = require('../xtransit');
xtransit.start(require(confPath));
