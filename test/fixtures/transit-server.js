'use strict';

const { v4 } = require('uuid');
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
let globalWs;
let onceSend = false;

wss.on('connection', function connection(ws) {
  console.log('new clinet connected');
  clientCount++;
  send({ ok: true, type: 'new_client_count', data: { clientCount } });

  globalWs = ws;

  ws.on('message', message => {
    message = JSON.parse(message);
    ws.send(JSON.stringify({ ok: true, data: { type: message.type } }));

    if (!onceSend) {
      onceSend = true;
      setTimeout(() => {
        ws.send(JSON.stringify({ traceId: v4(), type: 'exec_command', data: { command: 'get_node_processes', expiredTime: 15000 } }));
      }, 200);

      setTimeout(() => {
        ws.send(JSON.stringify({ traceId: v4(), type: 'exec_command', data: { command: 'get_node_processes' } }));
      }, 300);

      setTimeout(() => {
        ws.send(JSON.stringify({ traceId: v4(), type: 'exec_command', data: { command: 'get_node_processes1' } }));
      }, 400);
    }
  });

  ws.on('close', function close() {
    console.log('client disconnected');
  });

});

function shutdown() {
  globalWs && globalWs.send(JSON.stringify({ traceId: v4(), type: 'shutdown' }));
}

function close(delay) {
  if (delay) {
    setTimeout(() => process.exit(0), 1000);
    return;
  }
  process.exit(0);
}

// expired time
const runningTime = process.env.UNIT_TEST_TRANSIT_SERVER_RUNNING_TIME;
if (runningTime && !isNaN(runningTime)) {
  setTimeout(close, runningTime);
}

// wait for close
process.on('message', msg => {
  if (msg === 'close') {
    close();
  }

  if (msg === 'shutdown') {
    shutdown();
    close(true);
  }
});
