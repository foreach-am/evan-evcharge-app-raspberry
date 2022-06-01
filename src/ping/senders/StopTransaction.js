const { EventQueue, EventCommandEnum } = require('../../libraries/EventQueue');
const { WebSocketSender } = require('../../libraries/WebSocket');

const event = EventCommandEnum.EVENT_TRANSACTION_STOP;

function sendStopTransaction(data) {
  WebSocketSender.send(event, {
    transactionId: state.transactionId,
    idTag: 'B4A63CDF',
    timestamp: new Date().toISOString(),
    meterStop: 0, //data.pow1Kwh
  });
}

function sendStopTransactionHandler(data) {
  return EventQueue.register(event, data, function () {
    sendStopTransaction(data);
  });
}

module.exports = sendStopTransactionHandler;
