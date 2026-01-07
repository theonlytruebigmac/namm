export interface Node {
  id: string;
  nodeNum: number;
  shortName: string;
  longName: string;
  hwModel: HardwareModel;
  role: NodeRole;
  batteryLevel?: number;
  voltage?: number;
  snr?: number;
  rssi?: number;
  lastHeard: number;
  position?: Position;
  hopsAway?: number;
  isMobile?: boolean;
  isFavorite?: boolean;
  channelUtilization?: number;
  airUtilTx?: number;
  uptime?: number;
  neighborCount?: number;
}

export interface Position {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
}

export type NodeRole =
  | "CLIENT"
  | "CLIENT_MUTE"
  | "ROUTER"
  | "ROUTER_CLIENT"
  | "REPEATER"
  | "TRACKER"
  | "SENSOR"
  | "TAK"
  | "CLIENT_HIDDEN"
  | "LOST_AND_FOUND"
  | "TAK_TRACKER";

export type HardwareModel =
  | "HELTEC_V3"
  | "TBEAM"
  | "TBEAM_S3_CORE"
  | "TLORA_V2"
  | "STATION_G2"
  | "RAK4631"
  | "RAK11200"
  | "NANO_G2_ULTRA"
  | "LILYGO_TWATCH_S3"
  | "PORTDUINO"
  | "UNSET"
  | string;

export const NODE_ROLE_LABELS: Record<NodeRole, string> = {
  CLIENT: "Client",
  CLIENT_MUTE: "Client Mute",
  ROUTER: "Router",
  ROUTER_CLIENT: "Router Client",
  REPEATER: "Repeater",
  TRACKER: "Tracker",
  SENSOR: "Sensor",
  TAK: "TAK",
  CLIENT_HIDDEN: "Client Hidden",
  LOST_AND_FOUND: "Lost and Found",
  TAK_TRACKER: "TAK Tracker",
};

export const HARDWARE_MODEL_LABELS: Record<string, string> = {
  HELTEC_V3: "Heltec V3",
  TBEAM: "T-Beam",
  TBEAM_S3_CORE: "T-Beam S3 Core",
  TLORA_V2: "T-LoRa V2",
  STATION_G2: "Station G2",
  RAK4631: "RAK 4631",
  RAK11200: "RAK 11200",
  NANO_G2_ULTRA: "Nano G2 Ultra",
  LILYGO_TWATCH_S3: "LilyGo T-Watch S3",
  PORTDUINO: "Native/Portduino",
  UNSET: "Unknown",
};
