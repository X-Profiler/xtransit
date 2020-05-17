'use strict';

const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events').EventEmitter;
const utils = require('../common/utils');
const Logger = require('../common/logger');
const messageHandler = require('./handler');

const CONNECTED_EVENT = Symbol('XTRANSIT::CONNECTED');

class XtransitAgent extends EventEmitter {
  constructor(config) {
    super();
    this.checkAgentConfig(config);

    // required config
    this.server = config.server;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    // optional config
    this.logdir = path.resolve(config.logdir || os.tmpdir());
    this.logLevel = config.logLevel || 2;
    this.logger = config.logger || new Logger(this.logLevel);
    this.reconnectBaseTime = config.reconnectBaseTime || 60;
    this.heartbeatInterval = config.heartbeatInterval || 60;

    this.conn = null;
    this.connected = false;
    this.messageQueueMap = {};
    this.heartbeatTimer = null;
    this.clientId = utils.md5(`${uuidv4()}::${Date.now()}`);
  }

  checkAgentConfig(config) {
    if (!config.server || !utils.regularWsServer(config.server)) {
      throw new Error('config.server must be passed in!');
    }
    if (!config.appId) {
      throw new Error('config.appId must be passed in!');
    }
    if (!config.appSecret) {
      throw new Error('config.appSecret must be passed in!');
    }
  }

  destroy() {
    this.conn && this.conn.close();
    this.conn = null;
  }

  connect() {
    const logger = this.logger;
    const server = this.server;

    logger.info(`websocket client connecting to ${server}...`);
    const conn = new WebSocket(server);

    conn.on('message', message => {
      messageHandler.call(this, message);
    });

    conn.on('error', err => {
      logger.warn(`websocket client error: ${err}.`);
    });

    conn.on('open', () => {
      logger.info('websocket client has been connected.');
      this.connected = true;
      this.emit(CONNECTED_EVENT);
    });

    conn.on('close', () => {
      logger.error('websocket client has been closed.');
      this.connected = false;

      // reconnected
      this.destroy();
      const reconnectTime = utils.random(this.reconnectBaseTime);
      logger.info(`start reconnecting to ${server} after ${reconnectTime}s.`);
      setTimeout(() => this.run(), reconnectTime * 1000);
    });

    this.conn = conn;
  }

  send(type, msg) {
    if (!this.connected) {
      let listener = this.messageQueueMap[type];
      if (listener) {
        this.removeListener(CONNECTED_EVENT, listener);
      }
      listener = () => this.conn.send(JSON.stringify(msg));
      this.messageQueueMap[type] = listener;
      this.once(CONNECTED_EVENT, listener);
    } else {
      this.conn.send(JSON.stringify(msg));
    }
  }

  sendMessage(type, data = {}, traceId) {
    const message = {};
    message.appId = this.appId;
    message.agentId = utils.getAgentId();
    message.traceId = traceId || uuidv4();
    message.clientId = this.clientId;
    message.timestamp = Date.now();
    message.type = type;
    message.data = data;
    message.signature = utils.sign(message, this.appSecret);
    this.logger.debug(`[to xtransit-server] <<<<<<<<<<<<<<<<<<< ${JSON.stringify(message)}`);
    this.send(type, message);
  }

  heartbeat() {
    this.sendMessage('heartbeat');
  }

  startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeat();
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatInterval * 1000);
  }

  run() {
    this.connect();
    this.startHeartbeat();
  }
}

module.exports = XtransitAgent;
