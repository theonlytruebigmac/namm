import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSettings,
  saveSettings,
  clearAllData,
  AppSettings,
} from '../settings'

const defaultSettings: AppSettings = {
  connectionType: 'http',
  apiEndpoint: 'http://localhost:4403',
  autoReconnect: true,
  mqttBroker: 'mqtt://mqtt.meshtastic.org:1883',
  mqttUsername: 'meshdev',
  mqttPassword: 'large4cats',
  mqttTopic: 'msh/US/#',
  mqttUseTLS: false,
  notifyNewMessages: true,
  notifyNodeStatus: false,
  notifyLowBattery: true,
  notificationSound: true,
  compactMode: false,
  defaultMapLayer: 'street',
  showNodeLabels: true,
  clusterMarkers: true,
  autoCenter: false,
  storeMessages: true,
  analytics: false,
}

describe('settings', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('getSettings', () => {
    it('should return default settings when localStorage is empty', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)

      const settings = getSettings()

      expect(settings).toEqual(defaultSettings)
      expect(localStorage.getItem).toHaveBeenCalledWith('namm-settings')
    })

    it('should merge stored settings with defaults', () => {
      const storedSettings = { compactMode: true, notificationSound: false }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedSettings))

      const settings = getSettings()

      expect(settings).toEqual({
        ...defaultSettings,
        compactMode: true,
        notificationSound: false,
      })
    })

    it('should handle invalid JSON in localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-json')

      const settings = getSettings()

      expect(settings).toEqual(defaultSettings)
    })
  })

  describe('saveSettings', () => {
    it('should update partial settings', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(defaultSettings))

      saveSettings({ compactMode: true })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'namm-settings',
        JSON.stringify({ ...defaultSettings, compactMode: true })
      )
    })

    it('should dispatch settings-changed event', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(defaultSettings))
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      saveSettings({ notificationSound: false })

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settings-changed',
        })
      )
    })

    it('should preserve existing settings when updating', () => {
      const existingSettings = { ...defaultSettings, compactMode: true }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(existingSettings))

      saveSettings({ notificationSound: false })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'namm-settings',
        JSON.stringify({
          ...existingSettings,
          notificationSound: false,
        })
      )
    })
  })

  describe('AppSettings interface', () => {
    it('should have expected properties', () => {
      const settings = getSettings()

      expect(settings).toHaveProperty('connectionType')
      expect(settings).toHaveProperty('apiEndpoint')
      expect(settings).toHaveProperty('autoReconnect')
      expect(settings).toHaveProperty('notifyNewMessages')
      expect(settings).toHaveProperty('compactMode')
      expect(settings).toHaveProperty('defaultMapLayer')
      expect(settings).toHaveProperty('showNodeLabels')
      expect(settings).toHaveProperty('clusterMarkers')
      expect(settings).toHaveProperty('autoCenter')
    })

    it('should have valid connectionType value', () => {
      const settings = getSettings()
      expect(['http', 'mqtt', 'serial', 'ble']).toContain(settings.connectionType)
    })

    it('should have valid defaultMapLayer value', () => {
      const settings = getSettings()
      expect(['street', 'satellite', 'terrain']).toContain(settings.defaultMapLayer)
    })
  })
})
