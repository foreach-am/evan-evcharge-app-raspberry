module.exports = {
  BootNotification: require('./senders/BootNotification'),
  Authorize: require('./senders/Authorize'),
  HearthBeat: require('./senders/HearthBeat'),
  StartTransaction: require('./senders/StartTransaction'),
  StopTransaction: require('./senders/StopTransaction'),
  ReserveNow: require('./senders/ReserveNow'),
  ChangeAvailability: require('./senders/ChangeAvailability'),
  StatusNotification: require('./senders/StatusNotification'),
  RemoteStartTransaction: require('./senders/RemoteStartTransaction'),
  RemoteStopTransaction: require('./senders/RemoteStopTransaction'),
  Reset: require('./senders/Reset'),
  MeterValues: require('./senders/MeterValues'),
};
