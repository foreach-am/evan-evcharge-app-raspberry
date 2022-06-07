const { EventQueue, EventCommandEnum } = require('../../libraries/EventQueue');
const { WebSocketSender } = require('../../libraries/WebSocket');

const state = require('../../state');

const event = EventCommandEnum.EVENT_HEARTH_BEAT;

function sendHeartBeat(data) {
  WebSocketSender.send(event, {});

  setTimeout(function () {
    sendHeartBeatHandler(data);
  }, state.state.common.bootNotRequireTime * 1000);
}

function sendHeartBeatHandler(data) {
  return EventQueue.register(event, data, function () {
    sendHeartBeat(data);
  });
}

module.exports = sendHeartBeatHandler;
