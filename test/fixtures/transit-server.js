'use strict';

const { v4 } = require('uuid');
const WebSocket = require('ws');
const EventEmitter = require('events').EventEmitter;
const commandEvent = new EventEmitter();
const codes = { notExists: 'NOT_EXISIS' };

function send(msg) {
  if (typeof process.send === 'function') {
    process.send(msg);
  }
}

function onMessage(traceId, command, expect) {
  commandEvent.once(traceId, data => send({ type: 'command_test', expect, command, data }));
}

function sendMessage(ws, command, expect, expired, options = {}) {
  setTimeout(() => {
    const traceId = v4();
    if (!expect.ok) {
      switch (expect.code) {
        case codes.notExists:
          expect.message = `file ${command}.js not exists in`;
          break;
        default:
          expect.message = expect.code;
      }
    }

    onMessage(traceId, command, expect);
    const data = Object.assign({ command }, options);
    ws.send(JSON.stringify({ traceId, type: 'exec_command', data }));
  }, expired);
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
    const { traceId } = message;
    traceId && commandEvent.emit(traceId, message);
    ws.send(JSON.stringify({ ok: true, data: { type: message.type } }));

    if (!onceSend) {
      onceSend = true;
      sendMessage(ws, 'get_node_processes', { ok: true, override: false }, 200, { expiredTime: 15000 });
      sendMessage(ws, 'get_node_processes', { ok: true, override: false }, 300);
      sendMessage(ws, 'get_node_processes1', { ok: false, code: codes.notExists }, 400);
      sendMessage(ws, 'custom', { ok: true }, 500);
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
