/**
 * Nodes API
 *
 * Real Meshtastic HTTP API integration for nodes data
 */

import type { Node } from "@/types";
import { mockNodes, getNodeById as getMockNodeById } from "@/lib/mock";
import { delay } from "./client";
import { apiGet, apiPost } from "./http";
import { transformNode, transformDBNode, transformNodes, type APINode } from "./transformers";

const USE_REAL_API = true; // Always use real API

/**
 * Fetch all nodes from the Meshtastic API
 */
export async function getNodes(): Promise<Node[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ nodes: any[] }>("/api/nodes");

      if (!response.nodes || !Array.isArray(response.nodes)) {
        console.warn("Invalid nodes response format:", response);
        return [];
      }

      // Transform database nodes to frontend format
      return response.nodes.map(transformDBNode).sort(
        (a, b) => b.lastHeard - a.lastHeard
      );
    } catch (error) {
      console.error(
        "Failed to fetch real nodes, falling back to mock data:",
        error
      );
      // Fall back to mock data
    }
  }

  await delay();
  return [...mockNodes].sort((a, b) => b.lastHeard - a.lastHeard);
}

/**
 * Fetch a single node by ID
 */
export async function getNode(id: string): Promise<Node | null> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<any>(`/api/nodes/${id}`);
      if (!response) return null;
      return transformDBNode(response);
    } catch (error) {
      console.error(`Failed to fetch node ${id}:`, error);
      return null;
    }
  }

  await delay();
  return getMockNodeById(id) || null;
}

export async function getActiveNodes(hours: number = 24): Promise<Node[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ nodes: any[] }>(`/api/nodes?active=${hours}`);

      if (!response.nodes || !Array.isArray(response.nodes)) {
        console.warn("Invalid active nodes response format:", response);
        return [];
      }

      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      return response.nodes
        .map(transformDBNode)
        .filter(n => n.lastHeard >= cutoff)
        .sort((a, b) => b.lastHeard - a.lastHeard);
    } catch (error) {
      console.error(
        "Failed to fetch active nodes, falling back to mock:",
        error
      );
    }
  }

  await delay();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return mockNodes
    .filter(n => n.lastHeard >= cutoff)
    .sort((a, b) => b.lastHeard - a.lastHeard);
}

export async function getFavoriteNodes(): Promise<Node[]> {
  if (USE_REAL_API) {
    try {
      const response = await apiGet<{ nodes: any[] }>("/api/nodes?favorites=true");

      if (!response.nodes || !Array.isArray(response.nodes)) {
        console.warn("Invalid favorites response format:", response);
        return [];
      }

      return response.nodes.map(transformDBNode).filter(n => n.isFavorite);
    } catch (error) {
      console.error(
        "Failed to fetch favorite nodes, falling back to mock:",
        error
      );
    }
  }

  await delay();
  return mockNodes.filter(n => n.isFavorite);
}

export async function setNodeFavorite(id: string, isFavorite: boolean): Promise<Node> {
  if (USE_REAL_API) {
    try {
      const response = await apiPost<any>(`/api/nodes/${id}/favorite`, { isFavorite });
      if (response) {
        return transformDBNode(response);
      }
    } catch (error) {
      console.error(
        `Failed to set favorite for node ${id}, falling back to mock:`,
        error
      );
    }
  }

  await delay();
  const node = getMockNodeById(id);
  if (!node) throw new Error("Node not found");
  node.isFavorite = isFavorite;
  return node;
}
