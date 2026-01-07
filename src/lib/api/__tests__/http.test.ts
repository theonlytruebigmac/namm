import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  checkAPIConnection,
  getAPIHealth,
} from '../http'
import { APIError } from '../client'

// Mock fetch globally
global.fetch = vi.fn()

describe('HTTP Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
  })

  describe('apiRequest', () => {
    it('should make successful GET request', async () => {
      const mockData = { data: { nodes: [] }, status: 'success' }
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response)

      const result = await apiRequest('/api/nodes')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/nodes'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual({ nodes: [] })
    })

    it('should handle timeout', async () => {
      vi.mocked(fetch).mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            // Simulate the abort signal being triggered
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'))
              })
            }
          })
      )

      await expect(
        apiRequest('/api/nodes', { timeout: 100, retry: 0 })
      ).rejects.toThrow()
    })

    it('should retry on network error', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { success: true }, status: 'success' }),
        } as Response)

      const result = await apiRequest('/api/test', { retry: 2, retryDelay: 10 })

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ success: true })
    }, 10000)

    it('should not retry on 4xx errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not found' }),
      } as Response)

      await expect(apiRequest('/api/missing', { retry: 3, retryDelay: 10 })).rejects.toThrow('Not found')

      expect(fetch).toHaveBeenCalledTimes(1)
    }, 10000)

    it('should handle API error status', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'error', error: 'Custom error message' }),
      } as Response)

      await expect(apiRequest('/api/test', { retry: 0 })).rejects.toThrow('Custom error message')
    })

    it('should unwrap data from response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { key: 'value' }, status: 'success' }),
      } as Response)

      const result = await apiRequest('/api/test')

      expect(result).toEqual({ key: 'value' })
    })

    it('should handle response without data wrapper', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ key: 'value' }),
      } as Response)

      const result = await apiRequest('/api/test')

      expect(result).toEqual({ key: 'value' })
    })
  })

  describe('apiGet', () => {
    it('should make GET request', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)

      await apiGet('/api/nodes')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      )
    })
  })

  describe('apiPost', () => {
    it('should make POST request with body', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true } }),
      } as Response)

      await apiPost('/api/messages/send', { text: 'Hello', channel: 0 })

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Hello', channel: 0 }),
        })
      )
    })

    it('should make POST request without body', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true } }),
      } as Response)

      await apiPost('/api/test')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        })
      )
    })
  })

  describe('apiPut', () => {
    it('should make PUT request with body', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true } }),
      } as Response)

      await apiPut('/api/nodes/123', { isFavorite: true })

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ isFavorite: true }),
        })
      )
    })
  })

  describe('apiDelete', () => {
    it('should make DELETE request', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { success: true } }),
      } as Response)

      await apiDelete('/api/nodes/123')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('checkAPIConnection', () => {
    it('should return true when API is reachable', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { connected: true } }),
      } as Response)

      const result = await checkAPIConnection()

      expect(result).toBe(true)
    })

    it('should return false when API is unreachable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await checkAPIConnection()

      expect(result).toBe(false)
    })
  })

  describe('getAPIHealth', () => {
    it('should return health status when connected', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { version: '1.0.0', uptime: 3600 },
        }),
      } as Response)

      const result = await getAPIHealth()

      expect(result).toEqual({
        connected: true,
        version: '1.0.0',
        uptime: 3600,
      })
    })

    it('should return disconnected status on error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Connection failed'))

      const result = await getAPIHealth()

      expect(result).toEqual({ connected: false })
    }, 10000)
  })

  describe('APIError', () => {
    it('should create error with status code', () => {
      const error = new APIError(404, 'Not found')

      expect(error.status).toBe(404)
      expect(error.message).toBe('Not found')
      expect(error.name).toBe('APIError')
    })
  })

  describe('retry logic', () => {
    it('should use exponential backoff', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { success: true } }),
        } as Response)

      await apiRequest('/api/test', { retry: 2, retryDelay: 10 })

      // Should have retried twice
      expect(fetch).toHaveBeenCalledTimes(3)
    }, 10000)

    it('should fail after max retries', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent error'))

      await expect(apiRequest('/api/test', { retry: 2, retryDelay: 10 })).rejects.toThrow(
        'Failed after 3 attempts'
      )

      expect(fetch).toHaveBeenCalledTimes(3)
    }, 10000)
  })
})
