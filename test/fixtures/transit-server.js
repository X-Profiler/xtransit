'use strict';

const WebSocket = require('ws');

function send(msg) {
  if (typeof process.send === 'function') {
    process.send(msg);
  }
}

const port = process.env.UNIT_TEST_TRANSIT_SERVER_PORT || 9090;

const wss = new WebSocket.Server({ port }, () => {
  send('opened');
});

let clientCount = 0;

wss.on('connection', function connection(ws) {
  console.log('new clinet connected');
  clientCount++;
  send({ ok: true, type: 'new_client_count', data: { clientCount } });

  ws.on('message', message => {
    console.log('received: %s', message);
    message = JSON.parse(message);
    ws.send(JSON.stringify({ ok: true, data: { type: message.type } }));
  });

  ws.on('close', function close() {
    console.log('client disconnected');
  });

  // ws.send('something');
});

// expired time
const runningTime = process.env.UNIT_TEST_TRANSIT_SERVER_RUNNING_TIME;
if (runningTime && !isNaN(runningTime)) {
  setTimeout(() => process.exit(0), runningTime);
}

// wait for close
process.on('message', msg => {
  if (msg === 'close') {
    process.exit(0);
  }
});
