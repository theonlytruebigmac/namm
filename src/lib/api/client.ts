// In Phase 1, this uses mock data
// In Phase 2, this will make real HTTP requests

import { getSettings } from "@/lib/settings";

const MOCK_DELAY = 300; // Simulate network latency

export async function delay(ms: number = MOCK_DELAY): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

// Get API base URL from settings or environment
export function getAPIBaseURL(): string {
  // Always use relative URLs for the Next.js API routes
  // This ensures the frontend calls its own backend, not an external device
  return "";
}

// Legacy export for compatibility
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4403";
