/**
 * Hot Data Cache
 *
 * LRU cache for frequently accessed nodes and positions
 */

import { LRUCache } from 'lru-cache';
import { getDatabase } from '@/lib/db';
import { NodeRepository, PositionRepository } from '@/lib/db/db';
import type { DBNode, DBPosition } from '@/lib/db/types';

// Cache for active nodes (1 hour max age)
const nodeCache = new LRUCache<string, DBNode>({
  max: 1000, // Max 1000 nodes
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: true, // Refresh on access
  updateAgeOnHas: false
});

// Cache for latest positions (30 minutes max age)
const positionCache = new LRUCache<string, DBPosition>({
  max: 1000,
  ttl: 1000 * 60 * 30, // 30 minutes
  updateAgeOnGet: true,
  updateAgeOnHas: false
});

// Cache for position arrays by node (for history)
const positionHistoryCache = new LRUCache<string, DBPosition[]>({
  max: 100, // Cache 100 node histories
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true,
  updateAgeOnHas: false
});

/**
 * Get node by ID with caching
 */
export function getCachedNode(nodeId: string): DBNode | null {
  // Check cache first
  const cached = nodeCache.get(nodeId);
  if (cached) {
    return cached;
  }

  // Fetch from database
  const db = getDatabase();
  const nodeRepo = new NodeRepository(db);
  const node = nodeRepo.getById(nodeId);

  // Store in cache
  if (node) {
    nodeCache.set(nodeId, node);
  }

  return node;
}

/**
 * Get all active nodes with caching
 */
export function getCachedActiveNodes(activeWithin: number = 3600000): DBNode[] {
  const cacheKey = `active:${activeWithin}`;
  const cached = nodeCache.get(cacheKey) as unknown as DBNode[];

  if (cached) {
    return cached;
  }

  // Fetch from database
  const db = getDatabase();
  const nodeRepo = new NodeRepository(db);
  const nodes = nodeRepo.getAll({ activeWithin });

  // Store individual nodes in cache
  nodes.forEach(node => {
    nodeCache.set(node.id, node);
  });

  return nodes;
}

/**
 * Get latest position for node with caching
 */
export function getCachedLatestPosition(nodeId: string): DBPosition | null {
  const cacheKey = `latest:${nodeId}`;
  const cached = positionCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Fetch from database
  const db = getDatabase();
  const posRepo = new PositionRepository(db);
  const position = posRepo.getLatestForNode(nodeId);

  // Store in cache
  if (position) {
    positionCache.set(cacheKey, position);
  }

  return position;
}

/**
 * Get position history for node with caching
 */
export function getCachedPositionHistory(
  nodeId: string,
  limit: number = 100
): DBPosition[] {
  const cacheKey = `history:${nodeId}:${limit}`;
  const cached = positionHistoryCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Fetch from database
  const db = getDatabase();
  const posRepo = new PositionRepository(db);
  const positions = posRepo.getAllForNode(nodeId, limit);

  // Store in cache
  positionHistoryCache.set(cacheKey, positions);

  return positions;
}

/**
 * Invalidate node cache entry
 */
export function invalidateNodeCache(nodeId: string): void {
  nodeCache.delete(nodeId);
}

/**
 * Invalidate position cache entries for node
 */
export function invalidatePositionCache(nodeId: string): void {
  positionCache.delete(`latest:${nodeId}`);

  // Clear history cache entries
  const historyKeys = Array.from(positionHistoryCache.keys());
  historyKeys.forEach(key => {
    if (key.startsWith(`history:${nodeId}:`)) {
      positionHistoryCache.delete(key);
    }
  });
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  nodeCache.clear();
  positionCache.clear();
  positionHistoryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    nodes: {
      size: nodeCache.size,
      max: nodeCache.max,
      itemCount: nodeCache.size,
      calculatedSize: nodeCache.calculatedSize
    },
    positions: {
      size: positionCache.size,
      max: positionCache.max,
      itemCount: positionCache.size,
      calculatedSize: positionCache.calculatedSize
    },
    positionHistory: {
      size: positionHistoryCache.size,
      max: positionHistoryCache.max,
      itemCount: positionHistoryCache.size,
      calculatedSize: positionHistoryCache.calculatedSize
    }
  };
}

/**
 * Warm up cache with active nodes
 */
export function warmUpCache(): void {
  const db = getDatabase();
  const nodeRepo = new NodeRepository(db);
  const posRepo = new PositionRepository(db);

  // Load active nodes (last hour)
  const activeNodes = nodeRepo.getAll({ activeWithin: 3600000 });
  activeNodes.forEach(node => {
    nodeCache.set(node.id, node);

    // Load latest position
    const position = posRepo.getLatestForNode(node.id);
    if (position) {
      positionCache.set(`latest:${node.id}`, position);
    }
  });

  console.log(`Cache warmed up: ${activeNodes.length} nodes loaded`);
}
