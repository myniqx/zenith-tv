/**
 * M3U Parser Service
 * Wrapper around @zenith-tv/parser WASM module
 */

import { M3UObject } from '@/m3u/m3u';
import { initParser, parseM3U as wasmParseM3U } from '@zenith-tv/parser';

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
 * Parse M3U content using Rust WASM parser
 * Returns array of ParsedM3UItem with extracted metadata (year, season, episode)
 */
export async function parseM3U(content: string): Promise<M3UObject[]> {
  await ensureParserInit();

  // Check if content is valid
  if (!content || content.trim().length === 0) {
    throw new Error('M3U content is empty');
  }

  return await (wasmParseM3U(content) as Promise<M3UObject[]>);
}

