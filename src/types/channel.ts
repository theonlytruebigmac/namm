export interface Channel {
  id: string;
  index: number;
  name: string;
  psk?: string;
  isEncrypted: boolean;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: number;
}

export const DEFAULT_CHANNEL_NAMES = [
  "Primary",
  "Secondary",
  "Admin",
  "Direct",
  "Channel 4",
  "Channel 5",
  "Channel 6",
  "Channel 7",
];
