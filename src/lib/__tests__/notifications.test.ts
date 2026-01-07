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
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset Notification mock
    global.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any
  })

  describe('requestNotificationPermission', () => {
    it('should return true if permission already granted', async () => {
      global.Notification.permission = 'granted'

      const result = await requestNotificationPermission()

      expect(result).toBe(true)
      expect(Notification.requestPermission).not.toHaveBeenCalled()
    })

    it('should request permission if not yet decided', async () => {
      global.Notification.permission = 'default'
      vi.mocked(Notification.requestPermission).mockResolvedValue('granted')

      const result = await requestNotificationPermission()

      expect(result).toBe(true)
      expect(Notification.requestPermission).toHaveBeenCalled()
    })

    it('should return false if permission denied', async () => {
      global.Notification.permission = 'denied'

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
      global.Notification.permission = 'granted'
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
      global.Notification.permission = 'default'

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
      global.Notification.permission = 'granted'
      const NotificationMock = vi.fn()
      global.Notification = NotificationMock as any
      global.Notification.permission = 'granted'

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notificationSound: false,
      } as any)

      notifyNewMessage('TestNode', 'Hello World')

      expect(NotificationMock).toHaveBeenCalledWith(
        'New Message',
        expect.objectContaining({
          body: 'TestNode: Hello World',
        })
      )
    })

    it('should truncate long messages', () => {
      global.Notification.permission = 'granted'
      const NotificationMock = vi.fn()
      global.Notification = NotificationMock as any
      global.Notification.permission = 'granted'

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNewMessages: true,
        notificationSound: false,
      } as any)

      const longMessage = 'a'.repeat(150)
      notifyNewMessage('TestNode', longMessage)

      expect(NotificationMock).toHaveBeenCalledWith(
        'New Message',
        expect.objectContaining({
          body: expect.stringContaining('...'),
        })
      )
    })
  })

  describe('notifyNodeStatus', () => {
    it('should create notification for node online', () => {
      global.Notification.permission = 'granted'
      const NotificationMock = vi.fn()
      global.Notification = NotificationMock as any
      global.Notification.permission = 'granted'

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNodeStatus: true,
        notificationSound: false,
      } as any)

      notifyNodeStatus('TestNode', 'online')

      expect(NotificationMock).toHaveBeenCalledWith(
        'Node Status Change',
        expect.objectContaining({
          body: 'TestNode is now online',
        })
      )
    })

    it('should create notification for node offline', () => {
      global.Notification.permission = 'granted'
      const NotificationMock = vi.fn()
      global.Notification = NotificationMock as any
      global.Notification.permission = 'granted'

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyNodeStatus: true,
        notificationSound: false,
      } as any)

      notifyNodeStatus('TestNode', 'offline')

      expect(NotificationMock).toHaveBeenCalledWith(
        'Node Status Change',
        expect.objectContaining({
          body: 'TestNode is now offline',
        })
      )
    })
  })

  describe('notifyLowBattery', () => {
    it('should create notification for low battery', () => {
      global.Notification.permission = 'granted'
      const NotificationMock = vi.fn()
      global.Notification = NotificationMock as any
      global.Notification.permission = 'granted'

      vi.mocked(settings.getSettings).mockReturnValue({
        notifyLowBattery: true,
        notificationSound: false,
      } as any)

      notifyLowBattery('TestNode', 15)

      expect(NotificationMock).toHaveBeenCalledWith(
        'Low Battery Alert',
        expect.objectContaining({
          body: 'TestNode battery is at 15%',
        })
      )
    })
  })

  describe('initializeNotifications', () => {
    it('should request permission on first call', async () => {
      global.Notification.permission = 'default'
      const requestPermissionSpy = vi.spyOn(Notification, 'requestPermission')
        .mockResolvedValue('granted')

      await initializeNotifications()

      expect(requestPermissionSpy).toHaveBeenCalled()
    })
  })
})
