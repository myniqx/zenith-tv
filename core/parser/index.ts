import init, { parse_m3u, version } from './pkg/zenith_parser.js';

export interface ParsedM3UItem {
  title: string;
  url: string;
  group: string;
  logo?: string;
  category: 'Movie' | 'Series' | 'LiveStream';
  year?: number;
  season?: number;
  episode?: number;
}

let wasmInitialized = false;

/**
 * Initialize WASM module
 * Call this once before using the parser
 */
export async function initParser(): Promise<void> {
  if (wasmInitialized) return;

  await init();
  wasmInitialized = true;
  console.log(`Zenith Parser WASM initialized (v${version()})`);
}

/**
 * Parse M3U content
 * @param content M3U file content as string
 * @returns Array of parsed M3U items
 */
export async function parseM3U(content: string): Promise<ParsedM3UItem[]> {
  if (!wasmInitialized) {
    await initParser();
  }

  try {
    const result = parse_m3u(content);
    return result as ParsedM3UItem[];
  } catch (error) {
    console.error('M3U parsing error:', error);
    throw new Error(`Failed to parse M3U: ${error}`);
  }
}

export { version };
