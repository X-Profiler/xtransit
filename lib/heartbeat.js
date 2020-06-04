'use strict';

function heartbeat() {
  this.sendMessage('heartbeat');
}

module.exports = function() {
  clearInterval(this.heartbeatTimer);
  heartbeat.call(this);
  this.heartbeatTimer = setInterval(heartbeat.bind(this), this.heartbeatInterval * 1000);
};
