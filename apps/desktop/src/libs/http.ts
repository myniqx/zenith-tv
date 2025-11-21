import type { FetchOptions, FetchResponse, StreamOptions, HttpMethod } from '../types/ipc';

/**
 * Type-safe HTTP utilities built on Electron IPC
 */
export const http = {
  /**
   * Make HTTP request with type-safe response
   */
  async request<T = unknown>(url: string, options?: FetchOptions): Promise<FetchResponse<T>> {
    return window.electron.fetch.request<T>(url, options);
  },

  /**
   * GET request
   */
  async get<T = unknown>(url: string, options?: Omit<FetchOptions, 'method'>): Promise<FetchResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  },

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ): Promise<FetchResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  },

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ): Promise<FetchResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  },

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    url: string,
    options?: Omit<FetchOptions, 'method'>
  ): Promise<FetchResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  },

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<FetchOptions, 'method' | 'body'>
  ): Promise<FetchResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  },

  /**
   * Download file as text
   */
  async downloadText(url: string, options?: FetchOptions): Promise<string> {
    const response = await this.get<string>(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.data;
  },

  /**
   * Download and parse JSON
   */
  async downloadJSON<T>(url: string, options?: FetchOptions): Promise<T> {
    const response = await this.get<T>(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.data;
  },

  /**
   * Stream download with progress callbacks
   */
  async stream(url: string, options: StreamOptions): Promise<void> {
    return window.electron.fetch.stream(url, options);
  },

  /**
   * Download with progress tracking
   */
  async downloadWithProgress(
    url: string,
    onProgress: (chunk: string, totalReceived: number) => void,
    onError?: (error: Error) => void
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let accumulated = '';
      let totalBytes = 0;

      this.stream(url, {
        onChunk: (chunk) => {
          accumulated += chunk;
          totalBytes += chunk.length;
          onProgress(chunk, totalBytes);
        },
        onComplete: () => {
          resolve(accumulated);
        },
        onError: (error) => {
          onError?.(error);
          reject(error);
        },
      });
    });
  },

  /**
   * Check if URL is accessible (HEAD request simulation via GET with minimal data)
   */
  async isAccessible(url: string, timeout = 5000): Promise<boolean> {
    try {
      const response = await this.get(url, { timeout });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch with retry logic
   */
  async fetchWithRetry<T = unknown>(
    url: string,
    options?: FetchOptions,
    maxRetries = 3,
    retryDelay = 1000
  ): Promise<FetchResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.request<T>(url, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[HTTP] Retry ${attempt + 1}/${maxRetries} for ${url}:`, error);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Max retries reached');
  },

  /**
   * Create abort controller for request cancellation
   */
  createAbortController(): AbortController {
    return new AbortController();
  },

  /**
   * Build query string from object
   */
  buildQueryString(params: Record<string, string | number | boolean>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    return searchParams.toString();
  },

  /**
   * Make request with query parameters
   */
  async requestWithParams<T = unknown>(
    url: string,
    params: Record<string, string | number | boolean>,
    options?: FetchOptions
  ): Promise<FetchResponse<T>> {
    const queryString = this.buildQueryString(params);
    const urlWithParams = `${url}?${queryString}`;
    return this.request<T>(urlWithParams, options);
  },

  /**
   * Fetch M3U file with progress tracking
   * Supports both remote URLs and local file:// paths
   */
  async fetchM3U(url: string, onProgress?: (progress: number) => void): Promise<string> {
    return window.electron.fetch.m3u(url, onProgress);
  },
} as const;
