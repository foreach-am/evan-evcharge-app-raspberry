const { WebSocket: WebSocketClient } = require('ws');
const { EventCommandNameEnum } = require('./EventQueue');
const { Logger } = require('./Logger');
const { OfflineCommand } = require('./OfflineManager');
const { EventQueue } = require('./EventQueue');
// const { Networking } = require('./Networking');

/**
 * @param {import('http').ClientRequest} request
 * @param {import('http').IncomingMessage} response
 */
function parseIncomingMessage(request, response) {
  const bodyChunks = [];
  response
    .on('data', function (chunk) {
      bodyChunks.push(chunk.toString('utf-8'));
    })
    .on('end', function () {
      Logger.error(
        '[WS.Unexpected] Unexpected response received from server:',
        {
          requested: `${request.method}: ${request.protocol}//${request.host}${request.path}`,
          received: {
            body: bodyChunks.join(''),
            headers: response.headers,
          },
        }
      );
    });
}

const sleep = require('../utils/sleep');
const uuid = require('../utils/uuid');

const clientEvents = {
  connection: {},
  instance: {},
};

let connected = false;
/**
 * @type {import('ws')}
 */
let client = null;
function getConnection() {
  return client;
}

// connectWithUri(false);
connectWithUri(true);

const reconnectionMaxAttempts = 10;
const reconnectionDelays = {
  frequently: 5,
  longDelay: 30,
};

let reconnectionAttempts = 0;

function buildConnectionUrl() {
  let connectionUrl = process.env.WEBSOCKET_URL;
  if (connectionUrl) {
    if (connectionUrl.includes('?')) {
      connectionUrl += '&timestamp=' + Date.now();
    } else {
      connectionUrl += '?timestamp=' + Date.now();
    }
  }

  return connectionUrl;
}

async function connectWithUri(triggerPreviousEvents) {
  // const internetConnected = await Networking.isConnected();
  // if (!internetConnected) {
  //   Logger.warning('The charger was not connected to the internet.');
  //   return;
  // }

  if (client) {
    Logger.info('Removing all listeners on WebSocket ...');
    try {
      Logger.info(
        'Total registered listeners to remove:',
        client.listeners().length
      );

      client.removeAllListeners();
    } catch (e) {
      Logger.error('Failed to removing listeners on WebSocket:', e);
    }
    try {
      if (client.readyState === client.OPEN) {
        client.close();
      } else {
        Logger.warning('WebSocket client is not in open state.');
      }
    } catch (e) {
      Logger.error('Failed to close WebSocket before start:', e);
    }
    client = null;
  }

  Logger.info('Trying to connect to WebSocket server ...');

  client = new WebSocketClient(buildConnectionUrl(), ['ocpp1.6'], {
    followRedirects: true,
    maxRedirects: 5,
  });

  try {
    Logger.info('Listeners to remove before start:', client.listeners().length);
    client.removeAllListeners();
  } catch (e) {
    Logger.error('Failed to removing listeners before start:', e);
  }

  client.on('error', function (error) {
    Logger.error('[WS.Error] Could not connect to server:', error);
    connectionCloseCallback();
  });

  client.on('close', function (code, reason) {
    Logger.error('Closing WebSocket connection:', {
      code: code,
      reason: reason.toString('utf-8'),
    });
    connectionCloseCallback();
  });

  client.on('unexpected-response', function (req, res) {
    parseIncomingMessage(req, res);
    connectionCloseCallback();
  });

  client.on('open', async function () {
    reconnectionAttempts = 0;
    connected = true;

    client.on('error', function (error) {
      Logger.error('WebSocket connection error:', error);
      connectionCloseCallback();
    });

    client.on('unexpected-response', function (req, res) {
      parseIncomingMessage(req, res);
      connectionCloseCallback();
    });

    client.on('close', function (code, description) {
      Logger.error(`WebSocket connection closed [${code}]: ${description}`);
      connectionCloseCallback();
    });

    client.on('pong', function (binaryPayload) {
      const checkerId = Buffer.from(binaryPayload).toString('utf-8');
      Logger.info('WebSocket pong received:', checkerId);

      const index = pocketsPingPong.findIndex(function (oldId) {
        return oldId === checkerId;
      });

      if (index !== -1) {
        pocketsPingPong.splice(index, 1);
      }
    });

    client.on('drain', function () {
      Logger.info('WebSocket connection event triggered drain');
    });
    client.on('pause', function () {
      Logger.info('WebSocket connection event triggered pause');
    });
    client.on('resume', function () {
      Logger.info('WebSocket connection event triggered resume');
    });

    if (triggerPreviousEvents) {
      Object.keys(clientEvents.instance).forEach(function (eventName) {
        clientEvents.instance[eventName].forEach(function (listener) {
          if (eventName === 'message') {
            client.on(eventName, function (buffer) {
              messageParser(buffer, listener);
            });
          } else {
            client.on(eventName, listener);
          }
        });
      });
    }

    Logger.info('WebSocket connected successfully.');
    await executeOfflineQueue();
  });

  if (triggerPreviousEvents) {
    Object.keys(clientEvents.connection).forEach(function (eventName) {
      clientEvents.connection[eventName].forEach(function (listener) {
        client.on(eventName, listener);
      });
      clientEvents.connection[eventName] = [];
    });
  }
}

function connectionCloseCallback(tryReconnect = true) {
  if (connected) {
    Logger.warning('WebSocket - closing connection.');
    connected = false;

    // if (client) {
    //   client.close();
    // }
  }

  if (tryReconnect) {
    setTimeout(function () {
      reconnect();
    }, reconnectionDelays.longDelay * 1_000);
  }
}

// keep alive checker - every 10 seconds
const pocketsPingPong = [];
setInterval(function () {
  if (!client) {
    return;
  }

  if (client.readyState !== WebSocketClient.OPEN) {
    return;
  }

  const checkerId = uuid();
  pocketsPingPong.push(checkerId);

  Logger.info('WebSocket ping to server:', checkerId);
  if (typeof client.ping === 'function') {
    client.ping(checkerId);
  }

  setTimeout(function () {
    const index = pocketsPingPong.findIndex(function (oldId) {
      return oldId === checkerId;
    });

    if (index !== -1) {
      // PONG response not received during 2 seconds
      connectionCloseCallback();
    } else {
      connected = true;
    }
  }, 2_000);
}, 5_000);

let lastConnectionCheck = Date.now();
function reconnect() {
  lastConnectionCheck = Date.now();
  // if (connected) {
  //   return;
  // }

  Logger.info('Reconnecting to server ...');

  setTimeout(async function () {
    if (++reconnectionAttempts < reconnectionMaxAttempts) {
      await connectWithUri(true);
    } else {
      Logger.info(
        `${reconnectionAttempts} times tried to reconnect to WebSocket server.`
      );
      Logger.info(
        `now delaying ${reconnectionDelays.longDelay} seconds before re-try.`
      );

      reconnectionAttempts = 0;

      setTimeout(function () {
        reconnect();
      }, reconnectionDelays.longDelay * 1_000);
    }
  }, reconnectionDelays.frequently * 1_000);
}

setInterval(() => {
  if (!connected && Date.now() - lastConnectionCheck > 60_000) {
    reconnect();
  }
}, 60_000);

function onConnect(callback) {
  if (client?.readyState === client.OPEN) {
    callback(client);
  }

  clientEvents.connection['open'] = clientEvents.connection['open'] || [];
  clientEvents.connection['open'].push(callback);

  client?.on('open', callback);
}

function messageParser(buffer, callback) {
  const messageResult = buffer.toString('utf8');
  const message = {
    type: 'buffer',
    utf8Data: null,
    buffer: buffer,
  };

  if (typeof messageResult === 'string') {
    message.type = 'utf8';
    message.utf8Data = messageResult;
  }

  callback(message);
}

function register(eventName, callback) {
  clientEvents.instance[eventName] = clientEvents.instance[eventName] || [];
  clientEvents.instance[eventName].push(callback);

  if (!client) {
    return Logger.warning('WebSocket is not connected to server right now.');
  }

  if (eventName === 'message') {
    client.on(eventName, function (buffer) {
      messageParser(buffer, callback);
    });
  } else {
    client.on(eventName, callback);
  }
}

let isAlreadyStarted = false;
function startServer() {
  Logger.info('---------------------------------------------------------');
  Logger.info('-- Starting charging station server, please wait ...   --');
  Logger.info('---------------------------------------------------------');

  if (!isAlreadyStarted) {
    isAlreadyStarted = true;
    return;
  }

  connectWithUri(true);
}

function send({ sendType, commandId, messageId, commandArgs }) {
  const commandName = EventCommandNameEnum[commandId];

  if (!client || !isConnected()) {
    Logger.info(`Skipping ${commandName} - not connected.`);
    if (EventQueue.isOfflineCacheableCommand(commandName)) {
      OfflineCommand.push({
        sendType,
        commandId,
        messageId,
        commandArgs,
      });

      Logger.info(`Command ${commandName} inserted to offline queue.`);
    }
  }

  return sendDataToServer({
    sendType,
    commandId,
    messageId,
    commandArgs,
  });
}

function sendDataToServer({ sendType, commandId, messageId, commandArgs }) {
  const commandName = EventCommandNameEnum[commandId];
  if (!client) {
    Logger.warning(
      `Connection missing: ${commandName} [${messageId}] with arguments.`
    );
    return false;
  }

  const dataToSend =
    sendType === SendTypeEnum.Request
      ? [sendType, messageId, commandName, commandArgs]
      : [sendType, messageId, commandArgs];

  const dataToSenJson = JSON.stringify(dataToSend);
  Logger.json(
    `Calling ${commandName} [${messageId}] with arguments:`,
    commandArgs
  );

  try {
    if (client.readyState !== WebSocketClient.OPEN) {
      return false;
    }

    client.send(dataToSenJson, { binary: false });
    return true;
  } catch (error) {
    Logger.error(
      `ERROR -> Calling ${commandName} [${messageId}] with arguments:`,
      error
    );
    return false;
  }
}

async function executeOfflineQueue() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const offlineCommand = OfflineCommand.first();
    if (!offlineCommand) {
      return;
    }

    for (let i = 0; i < 3; ++i) {
      await sleep(10);

      Logger.json('Executing offline command:', offlineCommand);
      const dataSent = sendDataToServer(offlineCommand);

      if (!dataSent) {
        Logger.error('Failed to execute offline command, trying in next step.');
        // OfflineCommand.push(offlineCommand);
        continue;
      }

      break;
    }
  }
}

function isConnected() {
  return !!client && client.readyState === WebSocketClient.OPEN && connected;
}

const SendTypeEnum = {
  Request: 2,
  Response: 3,
  Error: 4,
};

module.exports = {
  SendTypeEnum: SendTypeEnum,
  WebSocket: {
    getConnection: getConnection,
    onConnect: onConnect,
    register: register,
    startServer: startServer,
    isConnected: isConnected,
  },
  WebSocketSender: {
    send: send,
  },
};
