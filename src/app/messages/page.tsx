"use client";

import { useChannels } from "@/hooks/useChannels";
import { useChannelMessages, useSendMessage, useAddReaction, useMarkChannelAsRead, useSearchMessages } from "@/hooks/useMessages";
import { useNodes } from "@/hooks/useNodes";
import { useWebSerial } from "@/hooks/useWebSerial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, Hash, Smile, Reply, Lock, Usb, Wifi, X, Search, Download, Clock, Check, CheckCheck, Pin, PinOff } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { ReactionEmoji, Message, Reaction, REACTION_EMOJIS } from "@/types";
import { Input } from "@/components/ui/input";
import { MessageTextWithLinks } from "@/components/messages/LinkPreview";
import { ThreadView, ThreadViewToggle } from "@/components/messages/ThreadView";
import { ScheduleMessageDialog } from "@/components/messages/ScheduledMessages";
import { TemplatePicker, TemplateAutoComplete } from "@/components/messages/MessageTemplates";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { exportMessagesToCSV, exportToJSON } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Use the allowed reactions from the types
const QUICK_REACTIONS = REACTION_EMOJIS;

function EmojiPicker({
  onSelect,
  onClose,
  isMyMessage
}: {
  onSelect: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  isMyMessage: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-1 ${isMyMessage ? "right-0" : "left-0"} z-50 flex gap-1 p-2 rounded-lg shadow-lg ${
        isMyMessage
          ? "bg-white/90 backdrop-blur"
          : "bg-[hsl(var(--card))] border border-[hsl(var(--border))]"
      }`}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          className="text-lg hover:scale-125 transition-transform p-1 rounded hover:bg-[hsl(var(--accent))]"
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default function MessagesPage() {
  const { data: channels, isLoading: channelsLoading } = useChannels();
  const { data: nodes } = useNodes();
  const { isConnected: serialConnected, sendMessage: serialSendMessage } = useWebSerial();
  const [selectedChannelIndex, setSelectedChannelIndex] = useState<number>(0);
  const [messageText, setMessageText] = useState("");
  const [sendVia, setSendVia] = useState<"mqtt" | "serial">("mqtt");
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isThreadView, setIsThreadView] = useState(false);

  const { data: messages, isLoading: messagesLoading } = useChannelMessages(selectedChannelIndex);
  const { data: searchResults, isLoading: searchLoading } = useSearchMessages(searchQuery);
  const { pinnedMessages, isPinned, togglePin } = usePinnedMessages(selectedChannelIndex);
  const sendMessage = useSendMessage();
  const addReaction = useAddReaction();
  const markAsRead = useMarkChannelAsRead();

  // Display search results when searching, otherwise channel messages
  const displayMessages = isSearching && searchQuery.length >= 2 ? searchResults : messages;

  // Mark messages as read when channel is viewed
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Check if there are unread messages
      const hasUnread = messages.some(m => !m.readAt);
      if (hasUnread) {
        markAsRead.mutate(selectedChannelIndex);
      }
    }
  }, [selectedChannelIndex, messages]);

  // Create a map from message ID to message for quick lookup of replied messages
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    messages?.forEach(m => map.set(m.id, m));
    return map;
  }, [messages]);

  if (channelsLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Channels Sidebar Skeleton */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-[hsl(var(--muted))]">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Messages Area Skeleton */}
          <Card className="lg:col-span-9">
            <CardHeader className="border-b border-[hsl(var(--border))]">
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[70%] space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-48 rounded-lg" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedChannel = channels?.find(c => c.index === selectedChannelIndex) || channels?.[0];
  const unreadCount = channels?.reduce((acc, c) => acc + c.unreadCount, 0) || 0;

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChannel) return;

    setIsSending(true);
    try {
      if (sendVia === "serial" && serialConnected) {
        // Send via Web Serial
        await serialSendMessage(messageText, { channel: selectedChannel.index });
      } else {
        // Send via MQTT API
        sendMessage.mutate({
          channel: selectedChannel.index,
          text: messageText,
          replyTo: replyTo?.id,
        });
      }
      setMessageText("");
      setReplyTo(null); // Clear reply state after sending
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const handleAddReaction = (messageId: string, emoji: ReactionEmoji) => {
    addReaction.mutate({ messageId, emoji });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
            Messages
          </h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            {unreadCount > 0 && `${unreadCount} unread · `}
            {isSearching && searchQuery.length >= 2
              ? `${searchResults?.length || 0} search results`
              : `${messages?.length || 0} messages in ${selectedChannel?.name || "channel"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(e.target.value.length > 0);
              }}
              className="pl-9 w-64"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearching(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!displayMessages?.length}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => displayMessages && exportMessagesToCSV(displayMessages)}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => displayMessages && exportToJSON(
                displayMessages,
                `messages_${selectedChannel?.name || "all"}_${new Date().toISOString().split("T")[0]}`
              )}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Channels Sidebar */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Only show channels that have messages */}
            {channels?.filter(c => c.lastMessageTime || c.unreadCount > 0).length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No channels with messages yet
              </div>
            ) : (
              channels?.filter(c => c.lastMessageTime || c.unreadCount > 0).map((channel) => (
              <button
                key={channel.index}
                onClick={() => setSelectedChannelIndex(channel.index)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedChannelIndex === channel.index
                    ? "bg-[hsl(var(--accent))] border border-[hsl(var(--green))]"
                    : "bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {channel.name === "LongFast" ? (
                      <Hash className="h-4 w-4 text-[hsl(var(--green))]" />
                    ) : (
                      <Lock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                    <span className="font-semibold text-sm text-[hsl(var(--foreground))]">
                      {channel.name}
                    </span>
                  </div>
                  {channel.unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5">
                      {channel.unreadCount}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Channel {channel.index}
                </div>
              </button>
            ))
            )}
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className="lg:col-span-9">
          <CardHeader className="border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedChannel?.name === "LongFast" ? (
                  <Hash className="h-5 w-5 text-[hsl(var(--green))]" />
                ) : (
                  <Lock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                )}
                <CardTitle>{selectedChannel?.name || "Select a channel"}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <ThreadViewToggle
                  isThreaded={isThreadView}
                  onToggle={() => setIsThreadView(!isThreadView)}
                />
                {selectedChannel && selectedChannel.unreadCount > 0 && (
                  <Badge variant="default">
                    {selectedChannel.unreadCount} unread
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search Results Info */}
            {isSearching && searchQuery.length >= 2 && (
              <div className="px-4 py-2 bg-[hsl(var(--accent))] border-b border-[hsl(var(--border))]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    <Search className="inline h-3 w-3 mr-1" />
                    Searching for "{searchQuery}"
                    {searchLoading && " ..."}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearching(false);
                    }}
                  >
                    Clear Search
                  </Button>
                </div>
              </div>
            )}
            {/* Messages List */}
            <div className="h-[calc(100vh-400px)] overflow-y-auto p-4 space-y-4">
              {/* Pinned Messages Section */}
              {pinnedMessages.length > 0 && !isSearching && (
                <div className="mb-4 p-3 bg-[hsl(var(--accent))] rounded-lg border border-[hsl(var(--border))]">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-[hsl(var(--foreground))]">
                    <Pin className="h-4 w-4 text-yellow-500" />
                    Pinned Messages ({pinnedMessages.length})
                  </div>
                  <div className="space-y-2">
                    {pinnedMessages.slice(0, 3).map((pinned) => {
                      const pinnedMsg = messages?.find(m => m.id === pinned.messageId);
                      if (!pinnedMsg) return null;
                      const sender = nodes?.find(n => n.id === pinnedMsg.fromNode);
                      return (
                        <div
                          key={pinned.messageId}
                          className="flex items-start gap-2 p-2 bg-[hsl(var(--muted))] rounded text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-[hsl(var(--green))]">
                              {sender?.shortName || "Unknown"}:
                            </span>{" "}
                            <span className="text-[hsl(var(--foreground))] truncate">
                              {pinnedMsg.text?.substring(0, 100)}
                            </span>
                          </div>
                          <button
                            onClick={() => togglePin(pinned.messageId, selectedChannelIndex)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    {pinnedMessages.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{pinnedMessages.length - 3} more pinned
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(messagesLoading || searchLoading) ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-8 w-8 text-[hsl(var(--muted-foreground))] animate-pulse mb-2" />
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {searchLoading ? "Searching..." : "Loading messages..."}
                  </div>
                </div>
              ) : displayMessages?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="rounded-full bg-[hsl(var(--muted))] p-4 mb-4">
                    {isSearching ? (
                      <Search className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                    ) : (
                      <MessageSquare className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                    )}
                  </div>
                  <p className="text-lg font-semibold text-[hsl(var(--foreground))] mb-1">
                    {isSearching ? "No results found" : "No messages yet"}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] text-center max-w-xs">
                    {isSearching
                      ? `No messages matching "${searchQuery}"`
                      : `Be the first to send a message in #${selectedChannel?.name || "this channel"}`}
                  </p>
                </div>
              ) : isThreadView && displayMessages && displayMessages.length > 0 ? (
                <ThreadView
                  messages={displayMessages}
                  nodes={nodes}
                  onReply={handleReply}
                  onReact={handleAddReaction}
                  isMyMessage={(message) => message.fromNode === "!abcd1234"}
                />
              ) : (
                displayMessages?.map((message: Message) => {
                  const sender = nodes?.find(n => n.id === message.fromNode);
                  const isMyMessage = message.fromNode === "!abcd1234"; // BASE station
                  const repliedMessage = message.replyTo ? messageMap.get(message.replyTo) : null;
                  const replySender = repliedMessage ? nodes?.find(n => n.id === repliedMessage.fromNode) : null;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] ${
                          isMyMessage
                            ? "bg-[hsl(var(--green))] text-white"
                            : "bg-[hsl(var(--muted))]"
                        } rounded-lg p-3 space-y-2`}
                      >
                        {/* Reply Reference */}
                        {repliedMessage && (
                          <div
                            className={`text-xs p-2 rounded border-l-2 ${
                              isMyMessage
                                ? "bg-white/10 border-white/50"
                                : "bg-[hsl(var(--accent))] border-[hsl(var(--green))]"
                            }`}
                          >
                            <span className={`font-semibold ${isMyMessage ? "text-white/80" : "text-[hsl(var(--green))]"}`}>
                              {replySender?.shortName || "Unknown"}
                            </span>
                            <p className={`truncate ${isMyMessage ? "text-white/70" : "text-[hsl(var(--muted-foreground))]"}`}>
                              {repliedMessage.text?.substring(0, 50)}{repliedMessage.text && repliedMessage.text.length > 50 ? "..." : ""}
                            </p>
                          </div>
                        )}

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

                        {/* Message Text with Link Previews */}
                        <div className={`${isMyMessage ? "text-white" : "text-[hsl(var(--foreground))]"}`}>
                          <MessageTextWithLinks
                            text={message.text}
                            showPreviews={true}
                            isMyMessage={isMyMessage}
                          />
                        </div>

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {message.reactions.map((reaction: Reaction, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => handleAddReaction(message.id, reaction.emoji)}
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

                        {/* Message Actions */}
                        <div className="flex items-center gap-2 pt-1 relative">
                          <button
                            onClick={() => handleReply(message)}
                            className={`text-xs ${
                              isMyMessage
                                ? "text-white opacity-70 hover:opacity-100"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            }`}
                            title="Reply"
                          >
                            <Reply className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEmojiPickerMessageId(
                              emojiPickerMessageId === message.id ? null : message.id
                            )}
                            className={`text-xs ${
                              isMyMessage
                                ? "text-white opacity-70 hover:opacity-100"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            }`}
                            title="React"
                          >
                            <Smile className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => togglePin(message.id, selectedChannelIndex)}
                            className={`text-xs ${
                              isPinned(message.id)
                                ? isMyMessage
                                  ? "text-yellow-300"
                                  : "text-yellow-500"
                                : isMyMessage
                                ? "text-white opacity-70 hover:opacity-100"
                                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                            }`}
                            title={isPinned(message.id) ? "Unpin" : "Pin"}
                          >
                            {isPinned(message.id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                          {emojiPickerMessageId === message.id && (
                            <EmojiPicker
                              onSelect={(emoji) => handleAddReaction(message.id, emoji)}
                              onClose={() => setEmojiPickerMessageId(null)}
                              isMyMessage={isMyMessage}
                            />
                          )}
                          {isMyMessage && (
                            <span className="text-xs opacity-70 ml-auto flex items-center gap-1">
                              {formatTimestamp(message.timestamp)}
                              {message.status === "delivered" || message.readAt ? (
                                <span title="Delivered">
                                  <CheckCheck className="h-3 w-3 text-blue-300" />
                                </span>
                              ) : message.status === "sent" ? (
                                <span title="Sent">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : message.status === "pending" ? (
                                <span title="Sending...">
                                  <Clock className="h-3 w-3 animate-pulse" />
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input */}
            <div className="border-t border-[hsl(var(--border))] p-4">
              {/* Reply Indicator */}
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-[hsl(var(--muted))] rounded-lg">
                  <Reply className="h-4 w-4 text-[hsl(var(--green))]" />
                  <div className="flex-1 text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Replying to </span>
                    <span className="font-semibold text-[hsl(var(--green))]">
                      {nodes?.find(n => n.id === replyTo.fromNode)?.shortName || "Unknown"}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">: </span>
                    <span className="text-[hsl(var(--foreground))]">
                      {replyTo.text?.substring(0, 40)}{replyTo.text && replyTo.text.length > 40 ? "..." : ""}
                    </span>
                  </div>
                  <button
                    onClick={cancelReply}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Template Autocomplete */}
                <div className="relative flex-1">
                  <TemplateAutoComplete
                    input={messageText}
                    onSelect={(content) => setMessageText(content)}
                  />
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Message ${selectedChannel?.name || "channel"}...`}
                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
                {/* Template Picker */}
                <TemplatePicker
                  onSelectTemplate={(content) => setMessageText(content)}
                  currentMessage={messageText}
                />
                {/* Send Method Toggle */}
                <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                  <button
                    onClick={() => setSendVia("mqtt")}
                    className={`px-2 py-2 flex items-center gap-1 text-xs ${
                      sendVia === "mqtt"
                        ? "bg-[hsl(var(--green))] text-white"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                    }`}
                    title="Send via MQTT"
                  >
                    <Wifi className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setSendVia("serial")}
                    disabled={!serialConnected}
                    className={`px-2 py-2 flex items-center gap-1 text-xs ${
                      sendVia === "serial"
                        ? "bg-[hsl(var(--green))] text-white"
                        : serialConnected
                        ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed"
                    }`}
                    title={serialConnected ? "Send via USB Serial" : "Connect USB device first"}
                  >
                    <Usb className="h-3 w-3" />
                  </button>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending || sendMessage.isPending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <ScheduleMessageDialog
                  channel={selectedChannelIndex}
                  channelName={selectedChannel?.name || "channel"}
                />
              </div>
              <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
