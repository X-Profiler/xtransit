'use strict';

const path = require('path');
const nounou = require('nounou');
const clientPath = path.join(__dirname, './client.js');
const argv = process.argv.slice(2);

const cfgPath = argv[0];

nounou(clientPath, {
  args: [cfgPath],
  count: 1,
}).on('fork', function(client) {
  console.log('[%s] [client:%d] new client start', Date(), client.pid);
}).on('disconnect', function(client) {
  console.error('[%s] [%s] client:%s disconnect, suicide: %s.',
    Date(), process.pid, client.pid, client.suicide);
})
  .on('expectedExit', function(client, code, signal) {
    console.log('[%s] [%s], client %s died (code: %s, signal: %s)', Date(),
      process.pid, client.pid, code, signal);
  })
  .on('unexpectedExit', function(client, code, signal) {
    const err = new Error(`client ${client.pid} died (code: ${code}, signal: ${signal})`);
    err.name = 'ClientDiedError';
    console.error('[%s] [%s] client exit: %s', Date(), process.pid, err.stack);
  });
