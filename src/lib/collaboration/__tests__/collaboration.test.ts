/**
 * Collaboration System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionManager,
  resetSessionManager,
  getUserColor,
  generateInviteCode,
  DEFAULT_SESSION_SETTINGS,
} from '../index';

describe('Collaboration System', () => {
  beforeEach(() => {
    resetSessionManager();
  });

  describe('getUserColor', () => {
    it('should return colors cyclically', () => {
      const color0 = getUserColor(0);
      const color1 = getUserColor(1);
      const color10 = getUserColor(10);

      expect(color0).toBe('#ef4444');
      expect(color1).toBe('#f97316');
      expect(color10).toBe(color0); // Cycles back
    });
  });

  describe('generateInviteCode', () => {
    it('should generate 6-character codes', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
    });

    it('should only use allowed characters', () => {
      const code = generateInviteCode();
      const allowedChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      expect(code).toMatch(allowedChars);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      // Should have at least 95 unique codes (allowing some collision)
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('SessionManager', () => {
    describe('createSession', () => {
      it('should create a new session', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice'
        );

        expect(session.id).toBeDefined();
        expect(session.name).toBe('Test Session');
        expect(session.ownerId).toBe('user-1');
        expect(session.users).toHaveLength(1);
        expect(session.users[0].name).toBe('Alice');
        expect(session.inviteCode).toHaveLength(6);
      });

      it('should use default settings', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice'
        );

        expect(session.settings).toEqual(DEFAULT_SESSION_SETTINGS);
      });

      it('should allow custom settings', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice',
          { maxUsers: 5, shareCursors: false }
        );

        expect(session.settings.maxUsers).toBe(5);
        expect(session.settings.shareCursors).toBe(false);
        expect(session.settings.shareViewport).toBe(true); // Default
      });
    });

    describe('joinSession', () => {
      it('should add user to session', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice'
        );

        const user = manager.joinSession(session, 'user-2', 'Bob');

        expect(user.id).toBe('user-2');
        expect(user.name).toBe('Bob');
        expect(manager.getUsers()).toHaveLength(2);
      });

      it('should assign different colors to users', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice'
        );

        const alice = manager.getCurrentUser();
        const bob = manager.joinSession(session, 'user-2', 'Bob');

        expect(alice?.color).not.toBe(bob.color);
      });
    });

    describe('leaveSession', () => {
      it('should clear session state', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        expect(manager.getSession()).not.toBeNull();

        manager.leaveSession();

        expect(manager.getSession()).toBeNull();
        expect(manager.getCurrentUser()).toBeNull();
        expect(manager.getUsers()).toHaveLength(0);
      });
    });

    describe('updatePresence', () => {
      it('should update user presence', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        manager.updatePresence({
          currentPage: '/map',
          selectedNodeId: 'node-123',
        });

        const presence = manager.getPresence('user-1');
        expect(presence?.currentPage).toBe('/map');
        expect(presence?.selectedNodeId).toBe('node-123');
      });

      it('should emit presence event', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const handler = vi.fn();
        manager.subscribe(handler);

        manager.updatePresence({ currentPage: '/nodes' });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'presence-updated',
            presence: expect.objectContaining({
              currentPage: '/nodes',
            }),
          })
        );
      });
    });

    describe('annotations', () => {
      it('should create annotations', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const annotation = manager.createAnnotation({
          type: 'note',
          target: { type: 'node', nodeId: 'node-123' },
          content: 'Important node',
          color: '#ff0000',
          createdBy: 'user-1',
        });

        expect(annotation.id).toBeDefined();
        expect(annotation.content).toBe('Important node');
        expect(manager.getAnnotations()).toHaveLength(1);
      });

      it('should update annotations', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const annotation = manager.createAnnotation({
          type: 'note',
          target: { type: 'node', nodeId: 'node-123' },
          content: 'Original',
          color: '#ff0000',
          createdBy: 'user-1',
        });

        const updated = manager.updateAnnotation(annotation.id, {
          content: 'Updated',
        });

        expect(updated?.content).toBe('Updated');
        expect(updated?.createdAt).toBe(annotation.createdAt);
      });

      it('should delete annotations', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const annotation = manager.createAnnotation({
          type: 'note',
          target: { type: 'node', nodeId: 'node-123' },
          content: 'To delete',
          color: '#ff0000',
          createdBy: 'user-1',
        });

        expect(manager.getAnnotations()).toHaveLength(1);

        const result = manager.deleteAnnotation(annotation.id);

        expect(result).toBe(true);
        expect(manager.getAnnotations()).toHaveLength(0);
      });
    });

    describe('events', () => {
      it('should emit user-joined event', () => {
        const manager = new SessionManager();
        const session = manager.createSession(
          'Test Session',
          'user-1',
          'Alice'
        );

        const handler = vi.fn();
        manager.subscribe(handler);

        manager.joinSession(session, 'user-2', 'Bob');

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'user-joined',
            user: expect.objectContaining({ name: 'Bob' }),
          })
        );
      });

      it('should emit user-left event', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const handler = vi.fn();
        manager.subscribe(handler);

        manager.leaveSession();

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'user-left',
            userId: 'user-1',
          })
        );
      });

      it('should allow unsubscribing', () => {
        const manager = new SessionManager();
        manager.createSession('Test Session', 'user-1', 'Alice');

        const handler = vi.fn();
        const unsubscribe = manager.subscribe(handler);

        manager.updatePresence({ currentPage: '/page1' });
        expect(handler).toHaveBeenCalledTimes(1);

        unsubscribe();

        manager.updatePresence({ currentPage: '/page2' });
        expect(handler).toHaveBeenCalledTimes(1); // Not called again
      });
    });
  });
});
