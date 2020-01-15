'use strict';

const WebSocket = require('ws');
const utils = require('./utils');

class XtransitAgent {
  constructor(config) {
    this.checkAgentConfig(config);

    this.conn = null;
    this.server = config.server;
    this.reconnectBaseTime = config.reconnectBaseTime || 60;
    this.logger = config.logger || console;
  }

  checkAgentConfig(config) {
    if (!config.server || !utils.regularWsServer(config.server)) {
      throw new Error(`config.server must be passed in!`);
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

    conn.on('error', err => {
      logger.error(`websocket client error: ${err}.`);
    });

    conn.on('open', () => logger.info(`websocket client has been connected.`));

    conn.on('close', () => {
      logger.error(`websocket client has been closed.`);

      // reconnected
      this.destroy();
      const reconnectTime = utils.random(this.reconnectBaseTime);
      logger.info(`start reconnecting to ${server} after ${reconnectTime}s.`);
      setTimeout(() => this.connect(), reconnectTime * 1000);
    });

    return conn;
  }

  run() {
    this.conn = this.connect();
  }
}

module.exports = XtransitAgent;