import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettings } from '../useSettings'
import { getSettings, saveSettings, AppSettings } from '@/lib/settings'

vi.mock('@/lib/settings', () => {
  const defaultSettings: AppSettings = {
    connectionType: 'http',
    apiEndpoint: 'http://localhost:4403',
    autoReconnect: true,
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

  return {
    getSettings: vi.fn(() => defaultSettings),
    saveSettings: vi.fn(),
  }
})

describe('useSettings', () => {
  const defaultSettings: AppSettings = {
    connectionType: 'http',
    apiEndpoint: 'http://localhost:4403',
    autoReconnect: true,
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

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSettings).mockReturnValue(defaultSettings)
  })

  it('should return current settings on mount', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current).toEqual(defaultSettings)
    expect(getSettings).toHaveBeenCalled()
  })

  it('should update when settings change via custom event', () => {
    const { result } = renderHook(() => useSettings())

    const updatedSettings = { ...defaultSettings, compactMode: true }

    // Dispatch custom event with updated settings
    act(() => {
      const event = new CustomEvent('settings-changed', {
        detail: updatedSettings,
      })
      window.dispatchEvent(event)
    })

    expect(result.current.compactMode).toBe(true)
  })

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useSettings())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('settings-changed', expect.any(Function))
  })

  it('should reflect multiple setting changes', () => {
    const { result } = renderHook(() => useSettings())

    // First update
    act(() => {
      const event = new CustomEvent('settings-changed', {
        detail: { ...defaultSettings, compactMode: true },
      })
      window.dispatchEvent(event)
    })

    expect(result.current.compactMode).toBe(true)

    // Second update
    act(() => {
      const event = new CustomEvent('settings-changed', {
        detail: { ...defaultSettings, compactMode: true, notificationSound: false },
      })
      window.dispatchEvent(event)
    })

    expect(result.current.compactMode).toBe(true)
    expect(result.current.notificationSound).toBe(false)
  })
})
