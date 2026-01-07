import { getAPIBaseURL, APIError } from "./client";

/**
 * Enhanced HTTP client for Meshtastic API communication
 * Supports authentication, retry logic, and error handling
 */

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retry?: number;
  retryDelay?: number;
}

export interface APIResponse<T = any> {
  data?: T;
  status: "success" | "error";
  error?: string;
}

// Default timeout for requests (10 seconds)
const DEFAULT_TIMEOUT = 10000;

// Default retry configuration
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Make an authenticated HTTP request to the Meshtastic API
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retry = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  const baseURL = getAPIBaseURL();
  const url = endpoint.startsWith("http") ? endpoint : `${baseURL}${endpoint}`;

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
          },
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new APIError(
            response.status,
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        // Parse response
        const data = await response.json();

        // Handle API error responses
        if (data.status === "error") {
          throw new APIError(500, data.error || "API returned error status");
        }

        // Return data unwrapped if it's in a wrapper
        return data.data !== undefined ? data.data : data;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) or abort
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new APIError(408, "Request timeout");
      }

      // Wait before retry (except on last attempt)
      if (attempt < retry) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        console.warn(`Retrying request to ${endpoint} (attempt ${attempt + 2}/${retry + 1})`);
      }
    }
  }

  // All retries exhausted
  throw new APIError(
    503,
    `Failed after ${retry + 1} attempts: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * GET request wrapper
 */
export async function apiGet<T = any>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: "GET" });
}

/**
 * POST request wrapper
 */
export async function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request wrapper
 */
export async function apiPut<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request wrapper
 */
export async function apiPatch<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request wrapper
 */
export async function apiDelete<T = any>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return apiRequest<T>(endpoint, { ...options, method: "DELETE" });
}

/**
 * Check if the API is reachable
 */
export async function checkAPIConnection(): Promise<boolean> {
  try {
    await apiGet("/api/health", { timeout: 5000, retry: 0 });
    return true;
  } catch (error) {
    console.error("API connection check failed:", error);
    return false;
  }
}

/**
 * Get API health/status information
 */
export async function getAPIHealth(): Promise<{
  connected: boolean;
  version?: string;
  uptime?: number;
}> {
  try {
    const data = await apiGet("/api/health", { timeout: 5000 });
    return {
      connected: true,
      version: data.version,
      uptime: data.uptime,
    };
  } catch (error) {
    return { connected: false };
  }
}
