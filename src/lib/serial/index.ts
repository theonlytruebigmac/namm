/**
 * Serial Module Exports
 */

export {
  SerialWorker,
  getSerialWorker,
  startSerialWorker,
  stopSerialWorker,
  listSerialPorts,
  type SerialWorkerConfig,
  type SerialWorkerStats,
} from './serial-worker';

export {
  parseSerialFrame,
  createSerialFrame,
  SerialFrameAccumulator,
  SERIAL_MAGIC,
  MAX_PAYLOAD_SIZE,
} from './serial-protocol';

export {
  decodeFromRadio,
  processFromRadioPacket,
  nodeNumToId,
  type DecodedFromRadio,
  type DecodedMyNodeInfo,
  type DecodedNodeInfo,
} from './fromradio-decoder';
