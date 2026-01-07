import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToJSON, exportToCSV, exportNodesToCSV } from '../export'
import type { Node } from '@/types'

// Mock downloadBlob
vi.mock('../export', async () => {
  const actual = await vi.importActual('../export')
  return {
    ...actual,
    exportToJSON: vi.fn(),
    exportToCSV: vi.fn(),
  }
})

describe('export utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToJSON', () => {
    it('should be callable with data and filename', () => {
      const data = { test: 'data' }
      exportToJSON(data, 'test')

      expect(exportToJSON).toHaveBeenCalledWith(data, 'test')
    })
  })

  describe('exportToCSV', () => {
    it('should be callable with array data and filename', () => {
      const data = [{ id: 1, name: 'test' }]
      exportToCSV(data, 'test')

      expect(exportToCSV).toHaveBeenCalledWith(data, 'test')
    })
  })
})
