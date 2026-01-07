/**
 * Compression Utilities
 *
 * Compress large payloads for WebSocket transmission
 */

import { gzipSync, gunzipSync } from 'zlib';

export interface CompressionOptions {
  threshold: number; // Minimum size in bytes to compress
  level?: number;    // Compression level (1-9)
}

const DEFAULT_OPTIONS: CompressionOptions = {
  threshold: 1024,  // 1KB
  level: 6          // Balanced compression
};

/**
 * Compress data if it exceeds threshold
 */
export function compressIfNeeded(
  data: string | Buffer,
  options: CompressionOptions = DEFAULT_OPTIONS
): { data: Buffer | string; compressed: boolean } {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

  // Skip compression if below threshold
  if (buffer.length < options.threshold) {
    return { data, compressed: false };
  }

  try {
    const compressed = gzipSync(buffer, { level: options.level });

    // Only use compressed if it's actually smaller
    if (compressed.length < buffer.length) {
      return { data: compressed, compressed: true };
    }

    return { data, compressed: false };
  } catch (error) {
    console.error('Compression failed:', error);
    return { data, compressed: false };
  }
}

/**
 * Decompress data
 */
export function decompress(data: Buffer): string {
  try {
    const decompressed = gunzipSync(data);
    return decompressed.toString('utf-8');
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new Error('Failed to decompress data');
  }
}

/**
 * Compress JSON object
 */
export function compressJSON<T>(
  obj: T,
  options: CompressionOptions = DEFAULT_OPTIONS
): { data: Buffer | string; compressed: boolean } {
  const json = JSON.stringify(obj);
  return compressIfNeeded(json, options);
}

/**
 * Decompress and parse JSON
 */
export function decompressJSON<T>(data: Buffer | string): T {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }

  const decompressed = decompress(data);
  return JSON.parse(decompressed);
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(original: number, compressed: number): number {
  return ((original - compressed) / original) * 100;
}

/**
 * Estimate compression benefit
 */
export function estimateCompressionBenefit(data: string | Buffer): {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  worthCompressing: boolean;
} {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  const compressed = gzipSync(buffer);

  const originalSize = buffer.length;
  const compressedSize = compressed.length;
  const ratio = getCompressionRatio(originalSize, compressedSize);

  return {
    originalSize,
    compressedSize,
    ratio,
    worthCompressing: compressedSize < originalSize && ratio > 10 // >10% savings
  };
}
