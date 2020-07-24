'use strict';

const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events').EventEmitter;
const utils = require('../common/utils');
const Logger = require('../common/logger');
const startHeartbeat = require('./heartbeat');
const startMonitor = require('./monitor');
const messageHandler = require('./handler');

const CONNECTED_EVENT = Symbol('XTRANSIT::CONNECTED');
const { WARN, DEBUG } = Logger.levels;

class XtransitAgent extends EventEmitter {
  constructor(config) {
    super();
    this.checkAgentConfig(config);

    // required config
    this.server = config.server;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    // optional config
    this.logdir = path.resolve(config.logdir || config.logDir || os.tmpdir());
    this.logLevel = config.logLevel || (process.env.XTRANSIT_DEBUG ? DEBUG : WARN);
    this.logger = config.logger || new Logger(this.logLevel);
    this.errexp = config.errexp || /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/i;
    this.reconnectBaseTime = config.reconnectBaseTime || 60;
    this.heartbeatInterval = config.heartbeatInterval || 60;
    this.docker = utils.isBoolean(config.docker) ? config.docker : false;
    this.ipMode = utils.isBoolean(config.ipMode) ? config.ipMode : false;
    this.libMode = utils.isBoolean(config.libMode) ? config.libMode : false;
    this.disks = Array.from(new Set(config.disks || []));
    this.errors = Array.from(new Set(config.errors || []));
    this.packages = Array.from(new Set(config.packages || []));
    this.titles = Array.from(new Set(config.titles || []));

    // global var
    this.conn = null;
    this.connected = false;
    this.messageQueueMap = {};
    this.heartbeatTimer = null;
    this.monitorTimer = null;
    this.clientId = utils.md5(`${uuidv4()}::${Date.now()}`);
    this.reconnect = true;
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

  shutdown() {
    this.reconnect = false;
    this.destroy();
    clearInterval(this.heartbeatTimer);
    startMonitor.clearMonitor();
    /* istanbul ignore next */
    if (!this.libMode && process.send) {
      process.send({ type: 'suicide' });
      process.exit(0);
    }
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
      if (!this.reconnect) {
        return;
      }
      const reconnectTime = utils.random(this.reconnectBaseTime);
      logger.info(`start reconnecting to ${server} after ${reconnectTime}s.`);
      setTimeout(() => this.run(), reconnectTime * 1000);
    });

    this.conn = conn;
  }

  sendMessageToServer(message) {
    this.logger.debug(`[to xtransit-server] <<<<<<<<<<<<<<<<<<< ${message}`);
    this.conn.send(message);
  }

  send(type, msg) {
    const message = JSON.stringify(msg);
    if (!this.connected) {
      let listener = this.messageQueueMap[type];
      if (listener) {
        this.removeListener(CONNECTED_EVENT, listener);
      }
      listener = () => this.sendMessageToServer(message);
      this.messageQueueMap[type] = listener;
      this.once(CONNECTED_EVENT, listener);
    } else {
      this.sendMessageToServer(message);
    }
  }

  sendMessage(type, data = {}, traceId) {
    const message = {};
    message.appId = this.appId;
    message.agentId = utils.getAgentId(this.ipMode);
    message.traceId = traceId || uuidv4();
    message.clientId = this.clientId;
    message.timestamp = Date.now();
    message.type = type;
    message.data = data;
    message.signature = utils.sign(message, this.appSecret);
    this.send(type, message);
  }

  run() {
    this.connect();
    startHeartbeat.call(this);
    startMonitor.call(this);
  }
}

module.exports = XtransitAgent;
