const { Logger } = require('../../libraries/Logger');
const { ComEmitter } = require('../../libraries/ComEmitter');

const state = require('../../state');
const ping = require('../../ping');
const uuid = require('../../utils/uuid');

module.exports = async function (parsedServerData) {
  const stopConnectorId = Object.keys(state.state.plugs.transactionId).find(function (itemConnectorId) {
    return state.state.plugs.transactionId[itemConnectorId] === parsedServerData.body.transactionId;
  });

  console.log(stopConnectorId, state.state.plugs.transactionId, parsedServerData.body.transactionId);

  if (!stopConnectorId) {
    Logger.warning(
      `There is no any transaction fund with server provided ID: ${parsedServerData.body.transactionId}`
    );
    return;
  }

  await ping.RemoteStopTransaction.execute(
    parsedServerData.messageId,
    parsedServerData.body.connectorId,
    ping.RemoteStopTransaction.StatusEnum.ACCEPTED
  );

  await ping.StatusNotification.execute(
    uuid(),
    parsedServerData.body.connectorId,
    ping.StatusNotification.StatusEnum.FINISHING,
    ping.StatusNotification.ErrorCodeEnum.NO_ERROR
  );

  ComEmitter.plugStop(stopConnectorId);
};
