export interface Message {
  id: string;
  fromNode: string;
  toNode: string;
  text: string;
  channel: number;
  timestamp: number;
  reactions?: Reaction[];
  replyTo?: string;
  status?: MessageStatus;
  hopStart?: number;
  hopLimit?: number;
  readAt?: number | null;
}

export interface Reaction {
  emoji: ReactionEmoji;
  fromNodes: string[];
}

export type ReactionEmoji = "👍" | "👎" | "❓" | "❗" | "😂" | "😢" | "💩";

export type MessageStatus = "pending" | "sent" | "delivered" | "failed";

export const REACTION_EMOJIS: ReactionEmoji[] = [
  "👍",
  "👎",
  "❓",
  "❗",
  "😂",
  "😢",
  "💩",
];
