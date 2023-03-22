const { WebSocket } = require('../../libraries/WebSocket');
const { LastTime } = require('../../libraries/OfflineManager');
const ping = require('../../ping');
const uuid = require('../../utils/uuid');
const state = require('../../state');
const execute = require('../../execute');
const { ComEmitter } = require('../../libraries/ComEmitter');
const { Logger } = require('../../libraries/Logger');

const initialState = (() => {
  try {
    state.loadSavedState();
    return JSON.parse(JSON.stringify(state.state.plugs.transactionId));
  } catch (e) {
    return {};
  }
})();

async function closeTransactionInCaseOfPowerReset() {
  const lastTimeSaved = LastTime.getLastTime();
  if (lastTimeSaved) {
    const last = new Date(lastTimeSaved);
    const diff = Date.now() - last;

    Logger.info(`Checking last transaction delay: ${diff}`);

    // don't close any transaction if previous action is less then 10 seconds.
    if (diff < 10 * 1000) {
      return;
    }
  }

  for (const connectorId in state.state.plugs.transactionId) {
    const lastTransactionId = state.state.plugs.transactionId[connectorId];
    if (!lastTransactionId) {
      continue;
    }

    if (initialState[connectorId] === lastTransactionId) {
      // if (
      //   initialState[connectorId] &&
      //   parseInt(initialState[connectorId]) > 0
      // ) {
      //   await ComEmitter.proxire(connectorId);
      // }

      const now = Date.now();
      const last = new Date(lastTimeSaved);
      const diff = now - last;
    }

    state.state.plugs.previousPlugState[connectorId] =
      state.statistic.plugs.plugState[connectorId];

    await ComEmitter.plugStop(connectorId);

    await execute.UpdateFlagStopTransaction(
      {},
      connectorId,
      ping.StopTransaction.ReasonEnum.Reboot
    );
  }
}

function registerLastTimeInterval() {
  LastTime.register(2);
}

let bootNotificationAlreadySent = false;
async function sendBootNotification() {
  if (bootNotificationAlreadySent) {
    return;
  }

  await ping.BootNotification.execute(uuid());
  bootNotificationAlreadySent = true;
}

module.exports = function ({ onConnect, onMessage }) {
  WebSocket.register('close', function () {
    ping.Heartbeat.cleanup();
  });

  // eslint-disable-next-line no-unused-vars
  WebSocket.onConnect(async function (connection) {
    if (typeof onConnect === 'function') {
      onConnect();
    }

    WebSocket.register('message', onMessage);

    await closeTransactionInCaseOfPowerReset();
    await sendBootNotification();
    await registerLastTimeInterval();
  });
};