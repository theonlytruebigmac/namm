'use client';

/**
 * Collaboration Cursors
 *
 * Displays other users' cursors on the screen
 */

import React from 'react';
import { useCollaboration } from '@/hooks/useCollaboration';

/**
 * Single cursor display
 */
function Cursor({
  name,
  color,
  x,
  y,
}: {
  name: string;
  color: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="fixed pointer-events-none z-50 transition-all duration-75"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5.5 3L19 12l-6 2-4 7-3.5-18z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute left-5 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}

/**
 * Collaboration cursors overlay
 */
export function CollaborationCursors() {
  const { connected, users, currentUser, presences, session } = useCollaboration();

  if (!connected || !session?.settings.shareCursors) {
    return null;
  }

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  return (
    <>
      {otherUsers.map((user) => {
        const presence = presences.get(user.id);
        if (!presence?.cursorPosition) {
          return null;
        }

        return (
          <Cursor
            key={user.id}
            name={user.name}
            color={user.color}
            x={presence.cursorPosition.x}
            y={presence.cursorPosition.y}
          />
        );
      })}
    </>
  );
}

export default CollaborationCursors;
