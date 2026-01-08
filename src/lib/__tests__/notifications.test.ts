import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  requestNotificationPermission,
  canShowNotification,
  notifyNewMessage,
  notifyNodeStatus,
  notifyLowBattery,
  initializeNotifications,
} from '../notifications'
import * as settings from '../settings'

// Mock settings module
vi.mock('../settings', () => ({
  getSettings: vi.fn(() => ({
    notifyNewMessages: true,
    notifyNodeStatus: true,
    notifyLowBattery: true,
    notificationSound: true,
    compactMode: false,
  })),
}))

describe('notifications', () => {
  let mockPermission: NotificationPermission = 'default';
  let NotificationConstructorMock: ReturnType<typeof vi.fn>;
  let requestPermissionMock: ReturnType<typeof vi.fn>;

  // Helper to set permission in tests
  const setPermission = (perm: NotificationPermission) => {
    mockPermission = perm;
  };

  // Helper to create notification mock with proper permission
  const setupNotificationMock = () => {
    NotificationConstructorMock = vi.fn();
    requestPermissionMock = vi.fn().mockResolvedValue('granted');

    // Create a constructor function that also has static properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NotificationMock: any = function(title: string, options?: NotificationOptions) {
      // @ts-expect-error - vi.fn() is callable but TS doesn't recognize it
      NotificationConstructorMock(title, options);
    };

    Object.defineProperty(NotificationMock, 'permission', {
      get: () => mockPermission,
      configurable: true,
    });
    NotificationMock.requestPermission = requestPermissionMock;

    global.Notification = NotificationMock;
  };

  beforeEach(() => {
    vi.clearAllMocks()
    mockPermission = 'default';
    setupNotificationMock();
  })

  describe('requestNotificationPermission', () => {
    it('should return true if permission already granted', async () => {
      setPermission('granted');

      const result = await requestNotificationPermission()

      expect(result).toBe(true)
      expect(Notification.requestPermission).not.toHaveBeenCalled()
    })

    it('should request permission if not yet decided', async () => {
      setPermission('default')
      vi.mocked(Notification.requestPermission).mockResolvedValue('granted')

      const result = await requestNotificationPermission()

      expect(result).toBe(true)
      expect(Notification.requestPermission).toHaveBeenCalled()
    })

    it('should return false if permission denied', async () => {
      setPermission('denied')

      const result = await requestNotificationPermission()

      expect(result).toBe(false)
      expect(Notification.requestPermission).not.toHaveBeenCalled()
    })

    it('should return false if browser does not support notifications', async () => {
      const originalNotification = global.Notification
      // @ts-ignore
      delete global.Notification

      const result = await requestNotificationPermission()

      expect(result).toBe(false)
      global.Notification = originalNotification
    })
  })

  describe('canShowNotification', () => {
    beforeEach(() => {
      setPermission('granted')
    })

    it('should return true for messages when enabled', () => {
      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notifyNodeStatus: false,
        notifyLowBattery: false,
        notificationSound: true,
        compactMode: false,
      } as any)

      expect(canShowNotification('message')).toBe(true)
    })

    it('should return false for messages when disabled', () => {
      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: false,
        notifyNodeStatus: false,
        notifyLowBattery: false,
        notificationSound: true,
        compactMode: false,
      } as any)

      expect(canShowNotification('message')).toBe(false)
    })

    it('should return false if permission not granted', () => {
      setPermission('default')

      expect(canShowNotification('message')).toBe(false)
    })

    it('should check correct setting for each notification type', () => {
      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notifyNodeStatus: false,
        notifyLowBattery: true,
        notificationSound: true,
        compactMode: false,
      } as any)

      expect(canShowNotification('message')).toBe(true)
      expect(canShowNotification('nodeStatus')).toBe(false)
      expect(canShowNotification('lowBattery')).toBe(true)
    })
  })

  describe('notifyNewMessage', () => {
    it('should create notification when enabled', () => {
      setPermission('granted')

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notificationSound: false,
      } as any)

      notifyNewMessage('TestNode', 'Hello World')

      expect(NotificationConstructorMock).toHaveBeenCalledWith(
        'New Message',
        expect.objectContaining({
          body: 'TestNode: Hello World',
        })
      )
    })

    it('should truncate long messages', () => {
      setPermission('granted')

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notificationSound: false,
      } as any)

      const longMessage = 'a'.repeat(150)
      notifyNewMessage('TestNode', longMessage)

      expect(NotificationConstructorMock).toHaveBeenCalledWith(
        'New Message',
        expect.objectContaining({
          body: expect.stringContaining('...'),
        })
      )
    })
  })

  describe('notifyNodeStatus', () => {
    it('should create notification for node online', () => {
      setPermission('granted')

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNodeStatus: true,
        notificationSound: false,
      } as any)

      notifyNodeStatus('TestNode', 'online')

      expect(NotificationConstructorMock).toHaveBeenCalledWith(
        'Node Status Change',
        expect.objectContaining({
          body: 'TestNode is now online',
        })
      )
    })

    it('should create notification for node offline', () => {
      setPermission('granted')

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNodeStatus: true,
        notificationSound: false,
      } as any)

      notifyNodeStatus('TestNode', 'offline')

      expect(NotificationConstructorMock).toHaveBeenCalledWith(
        'Node Status Change',
        expect.objectContaining({
          body: 'TestNode is now offline',
        })
      )
    })
  })

  describe('notifyLowBattery', () => {
    it('should create notification for low battery', () => {
      setPermission('granted')

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyLowBattery: true,
        notificationSound: false,
      } as any)

      notifyLowBattery('TestNode', 15)

      expect(NotificationConstructorMock).toHaveBeenCalledWith(
        'Low Battery Alert',
        expect.objectContaining({
          body: 'TestNode battery is at 15%',
        })
      )
    })
  })

  describe('initializeNotifications', () => {
    it('should request permission on first call', async () => {
      setPermission('default')

      await initializeNotifications()

      expect(requestPermissionMock).toHaveBeenCalled()
    })
  })
})
