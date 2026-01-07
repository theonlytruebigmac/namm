"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useScheduledMessages, type ScheduledMessage } from "@/hooks/useScheduledMessages";
import { Clock, Send, Trash2, X, Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

interface ScheduleMessageDialogProps {
  channel: number;
  channelName: string;
  onScheduled?: (id: string) => void;
}

export function ScheduleMessageDialog({ channel, channelName, onScheduled }: ScheduleMessageDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const { scheduleMessage } = useScheduledMessages();

  const handleSchedule = () => {
    if (!text.trim() || !date || !time) return;

    const scheduledTime = new Date(`${date}T${time}`);
    if (scheduledTime <= new Date()) {
      alert("Please select a future date and time");
      return;
    }

    const id = scheduleMessage(text.trim(), channel, scheduledTime);
    onScheduled?.(id);

    // Reset form
    setText("");
    setDate("");
    setTime("");
    setOpen(false);
  };

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedule Message
          </DialogTitle>
          <DialogDescription>
            Schedule a message to be sent to #{channelName} at a specific time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={237}
            />
            <p className="text-xs text-muted-foreground text-right">{text.length}/237</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {date && time && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Message will be sent on{" "}
                <span className="font-medium text-foreground">
                  {new Date(`${date}T${time}`).toLocaleString()}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!text.trim() || !date || !time}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getStatusIcon(status: ScheduledMessage["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "sent":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <X className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: ScheduledMessage["status"]) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "sent":
      return <Badge variant="default">Sent</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "cancelled":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Cancelled
        </Badge>
      );
  }
}

interface ScheduledMessagesListProps {
  channelFilter?: number;
}

export function ScheduledMessagesList({ channelFilter }: ScheduledMessagesListProps) {
  const { messages, cancelMessage, deleteMessage, clearCompleted } = useScheduledMessages();

  const filteredMessages =
    channelFilter !== undefined ? messages.filter((m) => m.channel === channelFilter) : messages;

  const pendingCount = filteredMessages.filter((m) => m.status === "pending").length;
  const hasCompleted = filteredMessages.some((m) => m.status !== "pending");

  if (filteredMessages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No scheduled messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pendingCount} pending message{pendingCount !== 1 ? "s" : ""}
        </p>
        {hasCompleted && (
          <Button variant="ghost" size="sm" onClick={clearCompleted}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear Completed
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {filteredMessages
          .sort((a, b) => a.scheduledTime - b.scheduledTime)
          .map((message) => (
            <div
              key={message.id}
              className="flex items-start gap-3 p-3 bg-muted rounded-lg hover:bg-accent transition-colors"
            >
              {getStatusIcon(message.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.text}</p>
                <p className="text-xs text-muted-foreground">
                  {message.status === "pending" ? "Scheduled for " : "Was scheduled for "}
                  {new Date(message.scheduledTime).toLocaleString()}
                </p>
                {message.error && <p className="text-xs text-red-500 mt-1">{message.error}</p>}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(message.status)}
                {message.status === "pending" && (
                  <Button variant="ghost" size="icon" onClick={() => cancelMessage(message.id)} title="Cancel">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {message.status !== "pending" && (
                  <Button variant="ghost" size="icon" onClick={() => deleteMessage(message.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function ScheduledMessagesCard() {
  const { pendingMessages } = useScheduledMessages();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Scheduled Messages
          </CardTitle>
          {pendingMessages.length > 0 && <Badge variant="secondary">{pendingMessages.length}</Badge>}
        </div>
        <CardDescription>Messages queued for future delivery</CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduledMessagesList />
      </CardContent>
    </Card>
  );
}
