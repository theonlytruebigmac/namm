"use client";

import { useMemo, useState } from "react";
import { Message, Reaction, ReactionEmoji } from "@/types";
import type { Node } from "@/types";
import { formatTimestamp } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageTextWithLinks } from "@/components/messages/LinkPreview";
import { ChevronDown, ChevronRight, MessageSquare, Reply, Smile } from "lucide-react";

interface MessageThread {
  root: Message;
  replies: Message[];
  replyCount: number;
  lastActivity: number;
}

interface ThreadViewProps {
  messages: Message[];
  nodes: Node[] | undefined;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
  isMyMessage: (message: Message) => boolean;
}

function groupIntoThreads(messages: Message[]): MessageThread[] {
  const threads: Map<string, MessageThread> = new Map();
  const replyToRoot: Map<string, string> = new Map();

  // Sort messages by timestamp ascending
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  for (const message of sorted) {
    if (message.replyTo) {
      // This is a reply - find the root thread
      let rootId = message.replyTo;

      // Follow the chain to find the original root
      while (replyToRoot.has(rootId)) {
        rootId = replyToRoot.get(rootId)!;
      }

      if (threads.has(rootId)) {
        // Add to existing thread
        const thread = threads.get(rootId)!;
        thread.replies.push(message);
        thread.replyCount++;
        thread.lastActivity = Math.max(thread.lastActivity, message.timestamp);
        replyToRoot.set(message.id, rootId);
      } else {
        // The root message isn't in our threads yet (maybe it's in a different channel?)
        // Create a new thread with this message as the "orphan" root
        threads.set(message.id, {
          root: message,
          replies: [],
          replyCount: 0,
          lastActivity: message.timestamp,
        });
      }
    } else {
      // This is a root message - create a new thread
      threads.set(message.id, {
        root: message,
        replies: [],
        replyCount: 0,
        lastActivity: message.timestamp,
      });
    }
  }

  // Sort threads by last activity (most recent first)
  return Array.from(threads.values()).sort((a, b) => b.lastActivity - a.lastActivity);
}

function ThreadMessage({
  message,
  sender,
  isMyMessage,
  isReply = false,
  onReply,
  onReact,
}: {
  message: Message;
  sender: Node | undefined;
  isMyMessage: boolean;
  isReply?: boolean;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  return (
    <div
      className={`flex ${isMyMessage ? "justify-end" : "justify-start"} ${isReply ? "ml-8" : ""}`}
    >
      <div
        className={`max-w-[70%] ${
          isMyMessage
            ? "bg-[hsl(var(--green))] text-white"
            : "bg-[hsl(var(--muted))]"
        } rounded-lg p-3 space-y-2`}
      >
        {/* Message Header */}
        {!isMyMessage && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[hsl(var(--green))]">
              {sender?.shortName || "Unknown"}
            </span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}

        {/* Message Text */}
        <div className={`${isMyMessage ? "text-white" : "text-[hsl(var(--foreground))]"}`}>
          <MessageTextWithLinks
            text={message.text}
            showPreviews={!isReply}
            isMyMessage={isMyMessage}
          />
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {message.reactions.map((reaction: Reaction, idx: number) => (
              <button
                key={idx}
                onClick={() => onReact(message.id, reaction.emoji)}
                className={`px-2 py-0.5 rounded-full text-xs ${
                  isMyMessage
                    ? "bg-white/20 text-white"
                    : "bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
                } hover:scale-110 transition-transform`}
              >
                {reaction.emoji} {reaction.fromNodes.length}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onReply(message)}
            className={`text-xs flex items-center gap-1 ${
              isMyMessage ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  nodes,
  isMyMessage,
  onReply,
  onReact,
}: {
  thread: MessageThread;
  nodes: Node[] | undefined;
  isMyMessage: (message: Message) => boolean;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  const [expanded, setExpanded] = useState(thread.replies.length <= 2);
  const rootSender = nodes?.find(n => n.id === thread.root.fromNode);

  return (
    <div className="space-y-2">
      {/* Root message */}
      <ThreadMessage
        message={thread.root}
        sender={rootSender}
        isMyMessage={isMyMessage(thread.root)}
        onReply={onReply}
        onReact={onReact}
      />

      {/* Thread info badge */}
      {thread.replies.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 ml-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <MessageSquare className="h-3 w-3" />
          <span>
            {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
          </span>
        </button>
      )}

      {/* Replies */}
      {expanded && thread.replies.length > 0 && (
        <div className="space-y-2 border-l-2 border-muted pl-2">
          {thread.replies.map((reply) => {
            const replySender = nodes?.find(n => n.id === reply.fromNode);
            return (
              <ThreadMessage
                key={reply.id}
                message={reply}
                sender={replySender}
                isMyMessage={isMyMessage(reply)}
                isReply
                onReply={onReply}
                onReact={onReact}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ThreadView({
  messages,
  nodes,
  onReply,
  onReact,
  isMyMessage,
}: ThreadViewProps) {
  const threads = useMemo(() => groupIntoThreads(messages), [messages]);

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
        <p>No messages yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <ThreadCard
          key={thread.root.id}
          thread={thread}
          nodes={nodes}
          isMyMessage={isMyMessage}
          onReply={onReply}
          onReact={onReact}
        />
      ))}
    </div>
  );
}

export function ThreadViewToggle({
  isThreaded,
  onToggle,
}: {
  isThreaded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={isThreaded ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      className="gap-2"
    >
      <MessageSquare className="h-4 w-4" />
      {isThreaded ? "Thread View" : "Flat View"}
    </Button>
  );
}
