/**
 * M3U Parser Service
 * Fetches and parses M3U playlists
 */

import { initParser, parseM3U, parseM3UWithTree, type ParsedM3UItem, type CategoryTree } from '@zenith-tv/parser';
import type { WatchableItem } from '@zenith-tv/types';
import { db } from './database';

let parserInitialized = false;

/**
 * Ensure WASM parser is initialized
 */
async function ensureParserInit(): Promise<void> {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}

/**
 * Fetch M3U content from URL
 */
export async function fetchM3U(
  url: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch M3U: ${response.statusText}`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

  if (!contentLength) {
    // No content length, just get text
    return await response.text();
  }

  // Stream with progress
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    if (value) {
      chunks.push(value);
      receivedLength += value.length;

      if (onProgress) {
        const percent = (receivedLength / contentLength) * 100;
        onProgress(percent);
      }
    }
  }

  // Combine chunks
  const chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  return new TextDecoder('utf-8').decode(chunksAll);
}

/**
 * Parse M3U content using Rust WASM parser
 */
export async function parseM3UContent(content: string): Promise<ParsedM3UItem[]> {
  await ensureParserInit();
  return await parseM3U(content);
}

/**
 * Parse M3U content and return CategoryTree (Rust WASM object)
 */
export async function parseM3UWithCategoryTree(content: string): Promise<CategoryTree> {
  await ensureParserInit();
  return await parseM3UWithTree(content);
}

// Re-export for convenience
export { parseM3U, parseM3UWithTree, CategoryTree };

/**
 * Convert parsed M3U items to WatchableItem format
 */
export function convertToWatchableItems(
  items: ParsedM3UItem[],
  profileId: number
): WatchableItem[] {
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    group: item.group,
    logo: item.logo,
    category: item.category,
    profileId,
    addedDate: new Date(),
    isFavorite: false,
  }));
}

/**
 * Full pipeline: Fetch → Parse → Convert (with caching)
 */
export async function fetchAndParseM3U(
  url: string,
  profileId: number,
  onProgress?: (stage: string, percent?: number) => void,
  force: boolean = false
): Promise<WatchableItem[]> {
  try {
    let content: string;
    let etag: string | undefined;
    let lastModified: string | undefined;

    // Try cache first (unless force is true)
    if (!force) {
      onProgress?.('Checking cache...', 0);
      const cached = await db.getM3UCache(url);

      if (cached) {
        console.log('[M3U] Using cached content');
        onProgress?.('Using cached content...', 50);
        content = cached.content;

        // Skip to parsing
        onProgress?.('Parsing M3U...', 50);
        const parsed = await parseM3UContent(content);

        onProgress?.('Processing items...', 75);
        const items = convertToWatchableItems(parsed, profileId);

        onProgress?.('Complete', 100);
        return items;
      }
    } else {
      // Force sync: invalidate cache
      console.log('[M3U] Force sync - invalidating cache');
      await db.invalidateM3UCache(url);
    }

    // Cache miss or force: Fetch from network
    onProgress?.('Downloading M3U...', 0);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch M3U: ${response.statusText}`);
    }

    // Extract cache headers
    etag = response.headers.get('etag') || undefined;
    lastModified = response.headers.get('last-modified') || undefined;

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

    if (!contentLength) {
      content = await response.text();
    } else {
      // Stream with progress
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedLength += value.length;

          if (onProgress) {
            const percent = Math.min(((receivedLength / contentLength) * 50), 50);
            onProgress?.('Downloading M3U...', percent);
          }
        }
      }

      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      content = new TextDecoder('utf-8').decode(chunksAll);
    }

    // Save to cache (expires in 24 hours)
    onProgress?.('Caching content...', 50);
    await db.saveM3UCache(url, content, etag, lastModified, 24);

    // Stage 2: Parse
    onProgress?.('Parsing M3U...', 60);
    const parsed = await parseM3UContent(content);

    // Stage 3: Convert
    onProgress?.('Processing items...', 80);
    const items = convertToWatchableItems(parsed, profileId);

    onProgress?.('Complete', 100);
    return items;
  } catch (error) {
    console.error('M3U fetch/parse error:', error);
    throw error;
  }
}
