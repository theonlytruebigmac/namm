'use client';

/**
 * Collaboration Panel
 *
 * Shows active collaborators and their presence
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  LogOut,
  Eye,
  EyeOff,
  Copy,
  Check,
  MapPin,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCollaboration } from '@/hooks/useCollaboration';
import type { CollaborationUser, UserPresence } from '@/lib/collaboration';

/**
 * User avatar with status indicator
 */
function UserAvatar({
  user,
  size = 'md',
}: {
  user: CollaborationUser;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium text-white`}
        style={{ backgroundColor: user.color }}
        title={user.name}
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div
        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[user.status]}`}
      />
    </div>
  );
}

/**
 * Presence indicator showing what a user is doing
 */
function PresenceIndicator({ presence }: { presence: UserPresence }) {
  const pageNames: Record<string, string> = {
    '/': 'Dashboard',
    '/map': 'Map',
    '/nodes': 'Nodes',
    '/messages': 'Messages',
    '/settings': 'Settings',
  };

  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1">
      <MapPin className="w-3 h-3" />
      <span>{pageNames[presence.currentPage] || presence.currentPage}</span>
      {presence.selectedNodeId && (
        <>
          <span>•</span>
          <span>Node: {presence.selectedNodeId}</span>
        </>
      )}
    </div>
  );
}

/**
 * User list item
 */
function UserListItem({
  user,
  presence,
  isFollowing,
  onFollow,
  onUnfollow,
  isCurrentUser,
}: {
  user: CollaborationUser;
  presence?: UserPresence;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  isCurrentUser: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div>
          <div className="font-medium text-sm flex items-center gap-2">
            {user.name}
            {isCurrentUser && (
              <Badge variant="outline" className="text-xs">
                You
              </Badge>
            )}
          </div>
          {presence && <PresenceIndicator presence={presence} />}
        </div>
      </div>
      {!isCurrentUser && (
        <Button
          variant="ghost"
          size="sm"
          onClick={isFollowing ? onUnfollow : onFollow}
          title={isFollowing ? 'Stop following' : 'Follow view'}
        >
          {isFollowing ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
}

/**
 * Create session dialog
 */
function CreateSessionDialog({
  onCreateSession,
}: {
  onCreateSession: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  const handleCreate = () => {
    if (name.trim()) {
      onCreateSession(name.trim());
      setName('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <UserPlus className="w-4 h-4 mr-2" />
          Start Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Collaboration Session</DialogTitle>
          <DialogDescription>
            Create a new session to collaborate with others in real-time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Session Name</Label>
            <Input
              id="session-name"
              placeholder="My Mesh Network Analysis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Join session dialog
 */
function JoinSessionDialog({
  onJoinSession,
}: {
  onJoinSession: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);

  const handleJoin = () => {
    if (code.trim()) {
      onJoinSession(code.trim().toUpperCase());
      setCode('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Join Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Collaboration Session</DialogTitle>
          <DialogDescription>
            Enter the invite code to join an existing session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={code.length < 6}>
            Join Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Invite code display
 */
function InviteCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">Invite Code</div>
        <div className="font-mono text-lg tracking-widest">{code}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

/**
 * Main collaboration panel component
 */
export function CollaborationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    connected,
    loading,
    session,
    currentUser,
    users,
    presences,
    followingUser,
    createSession,
    joinSession,
    leaveSession,
    followUser,
    unfollowUser,
  } = useCollaboration();

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Users className="w-4 h-4 mr-2" />
          Collaborate
          {connected && otherUsers.length > 0 && (
            <Badge
              variant="default"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
            >
              {otherUsers.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Collaboration
          </DialogTitle>
          <DialogDescription>
            {connected
              ? `${users.length} user${users.length !== 1 ? 's' : ''} in session`
              : 'Start or join a session to collaborate'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!connected ? (
            // Not connected - show create/join options
            <div className="space-y-3">
              <CreateSessionDialog
                onCreateSession={(name) => createSession(name)}
              />
              <JoinSessionDialog
                onJoinSession={(code) => joinSession(code, code)}
              />
            </div>
          ) : (
            // Connected - show session info and users
            <>
              {/* Session info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{session?.name}</h3>
                  <Button variant="ghost" size="sm" onClick={leaveSession}>
                    <LogOut className="w-4 h-4 mr-1" />
                    Leave
                  </Button>
                </div>
                {session?.inviteCode && (
                  <InviteCodeDisplay code={session.inviteCode} />
                )}
              </div>

              {/* Following indicator */}
              {followingUser && (
                <div
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ backgroundColor: `${followingUser.color}20` }}
                >
                  <Eye className="w-4 h-4" style={{ color: followingUser.color }} />
                  <span className="text-sm">
                    Following {followingUser.name}&apos;s view
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={unfollowUser}
                    className="ml-auto"
                  >
                    <EyeOff className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* User list */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Participants
                </h4>
                <div className="divide-y">
                  {users.map((user) => (
                    <UserListItem
                      key={user.id}
                      user={user}
                      presence={presences.get(user.id)}
                      isFollowing={followingUser?.id === user.id}
                      onFollow={() => followUser(user.id)}
                      onUnfollow={unfollowUser}
                      isCurrentUser={user.id === currentUser?.id}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CollaborationPanel;
