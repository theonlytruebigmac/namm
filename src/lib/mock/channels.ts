import { Channel, DEFAULT_CHANNEL_NAMES } from "@/types";
import { mockMessages } from "./messages";

function generateChannels(): Channel[] {
  return DEFAULT_CHANNEL_NAMES.map((name, index) => {
    const channelMessages = mockMessages.filter(
      m => m.channel === index && m.toNode === "broadcast"
    );
    const lastMsg = channelMessages[channelMessages.length - 1];

    return {
      id: `ch-${index}`,
      index,
      name,
      isEncrypted: index !== 0, // Primary is unencrypted
      uplinkEnabled: index < 4,
      downlinkEnabled: index < 4,
      unreadCount: index < 2 ? Math.floor(Math.random() * 5) : 0,
      lastMessage: lastMsg?.text,
      lastMessageTime: lastMsg?.timestamp,
    };
  });
}

export const mockChannels: Channel[] = generateChannels();

export function getChannel(index: number): Channel | undefined {
  return mockChannels.find(c => c.index === index);
}
