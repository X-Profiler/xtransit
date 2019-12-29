'use strict';

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('new clinet connected');

  ws.on('message', message => {
    console.log('received: %s', message);
  });

  ws.on('close', function close() {
    console.log('client disconnected');
  });

  // ws.send('something');
});