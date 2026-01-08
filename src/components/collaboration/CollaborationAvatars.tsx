'use client';

/**
 * Collaboration Avatars
 *
 * Compact avatar stack for header display
 */

import React from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';

/**
 * Avatar stack showing collaborators
 */
export function CollaborationAvatars() {
  const { connected, users, currentUser } = useCollaboration();

  if (!connected || users.length <= 1) {
    return null;
  }

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);
  const displayUsers = otherUsers.slice(0, 3);
  const overflowCount = otherUsers.length - 3;

  return (
    <div className="flex items-center -space-x-2">
      {displayUsers.map((user) => {
        const initials = user.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div
            key={user.id}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-background cursor-default"
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
        );
      })}

      {overflowCount > 0 && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground border-2 border-background cursor-default"
          title={otherUsers
            .slice(3)
            .map((u) => u.name)
            .join(', ')}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

export default CollaborationAvatars;
