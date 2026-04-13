use serde::{Deserialize, Serialize};

mod parser;
mod categorizer;
mod episode_detector;
mod year_detector;

pub use parser::M3UParser;
pub use categorizer::{Category, categorize_item, CategorizedItem};
pub use episode_detector::{Episode, detect_episode};
pub use year_detector::{detect_year, YearInfo};

/// Represents a parsed M3U item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct M3UItem {
    pub title: String,
    pub url: String,
    pub group: String,
    pub logo: Option<String>,
    pub category: Category,
    pub year: Option<u32>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

// ---------------------------------------------------------------------------
// WASM bindings — desktop / Tizen
// ---------------------------------------------------------------------------

#[cfg(target_arch = "wasm32")]
mod wasm_api {
    use wasm_bindgen::prelude::*;
    use super::*;

    #[wasm_bindgen]
    pub fn parse_m3u(content: &str) -> Result<JsValue, JsValue> {
        let parser = M3UParser::new(content);
        match parser.parse() {
            Ok(items) => serde_wasm_bindgen::to_value(&items)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e))),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }

    #[wasm_bindgen]
    pub fn version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}

// ---------------------------------------------------------------------------
// Native FFI — Android (flat buffer layout)
//
// Buffer layout written by parse_m3u_ffi:
//   [string_pool: u8 ...]           — all strings, null-terminated, UTF-8
//   [items: FfiItem * count]         — fixed-size item descriptors
//   [count: u32]                     — item count (last 4 bytes)
//
// FfiItem (all u32, 8 fields × 4 bytes = 32 bytes):
//   title_off, url_off, group_off, logo_off   — byte offsets into string_pool
//                                               logo_off = u32::MAX means None
//   category   — 0=LiveStream, 1=Series, 2=Movie
//   year       — 0 means None
//   season     — 0 means None
//   episode    — 0 means None
//
// Caller must free with free_parse_result(ptr, len).
// ---------------------------------------------------------------------------

#[cfg(not(target_arch = "wasm32"))]
mod ffi_api {
    use std::os::raw::c_char;
    use super::*;

    const CATEGORY_LIVE_STREAM: u32 = 0;
    const CATEGORY_SERIES: u32 = 1;
    const CATEGORY_MOVIE: u32 = 2;

    /// Parse M3U content passed as a UTF-8 byte pointer + length.
    /// Returns a pointer to the flat buffer and writes total byte length to `out_len`.
    /// Returns null on parse error.
    /// Caller must free with `free_parse_result`.
    #[no_mangle]
    pub unsafe extern "C" fn parse_m3u_ffi(
        content_ptr: *const c_char,
        content_len: usize,
        out_len: *mut usize,
    ) -> *mut u8 {
        let bytes = std::slice::from_raw_parts(content_ptr as *const u8, content_len);
        let content = match std::str::from_utf8(bytes) {
            Ok(s) => s,
            Err(_) => return std::ptr::null_mut(),
        };

        let items = match M3UParser::new(content).parse() {
            Ok(v) => v,
            Err(_) => return std::ptr::null_mut(),
        };

        let buf = build_flat_buffer(&items);
        *out_len = buf.len();

        // Leak the Vec so the pointer stays valid; caller frees via free_parse_result
        let mut buf = std::mem::ManuallyDrop::new(buf);
        buf.as_mut_ptr()
    }

    /// Free a buffer previously returned by `parse_m3u_ffi`.
    #[no_mangle]
    pub unsafe extern "C" fn free_parse_result(ptr: *mut u8, len: usize) {
        if ptr.is_null() { return; }
        drop(Vec::from_raw_parts(ptr, len, len));
    }

    /// Build the flat buffer from parsed items.
    fn build_flat_buffer(items: &[M3UItem]) -> Vec<u8> {
        // --- Pass 1: build string pool ---
        let mut string_pool: Vec<u8> = Vec::new();

        // Returns offset of string written into pool
        let write_str = |pool: &mut Vec<u8>, s: &str| -> u32 {
            let offset = pool.len() as u32;
            pool.extend_from_slice(s.as_bytes());
            pool.push(0); // null-terminate
            offset
        };

        // Collect offsets per item
        struct Offsets {
            title: u32,
            url: u32,
            group: u32,
            logo: u32, // u32::MAX = None
            category: u32,
            year: u32,
            season: u32,
            episode: u32,
        }

        let mut offsets_list: Vec<Offsets> = Vec::with_capacity(items.len());

        for item in items {
            let title = write_str(&mut string_pool, &item.title);
            let url = write_str(&mut string_pool, &item.url);
            let group = write_str(&mut string_pool, &item.group);
            let logo = match &item.logo {
                Some(s) => write_str(&mut string_pool, s),
                None => u32::MAX,
            };
            let category = match item.category {
                Category::LiveStream => CATEGORY_LIVE_STREAM,
                Category::Series => CATEGORY_SERIES,
                Category::Movie => CATEGORY_MOVIE,
            };
            offsets_list.push(Offsets {
                title,
                url,
                group,
                logo,
                category,
                year: item.year.unwrap_or(0),
                season: item.season.unwrap_or(0),
                episode: item.episode.unwrap_or(0),
            });
        }

        // --- Pass 2: assemble buffer ---
        // [string_pool][FfiItem * n][count: u32]
        let item_block_size = items.len() * 8 * 4; // 8 u32 fields × 4 bytes
        let total = string_pool.len() + item_block_size + 4;
        let mut buf: Vec<u8> = Vec::with_capacity(total);

        // String pool
        buf.extend_from_slice(&string_pool);

        // Item descriptors
        for o in &offsets_list {
            buf.extend_from_slice(&o.title.to_le_bytes());
            buf.extend_from_slice(&o.url.to_le_bytes());
            buf.extend_from_slice(&o.group.to_le_bytes());
            buf.extend_from_slice(&o.logo.to_le_bytes());
            buf.extend_from_slice(&o.category.to_le_bytes());
            buf.extend_from_slice(&o.year.to_le_bytes());
            buf.extend_from_slice(&o.season.to_le_bytes());
            buf.extend_from_slice(&o.episode.to_le_bytes());
        }

        // Item count (last 4 bytes)
        buf.extend_from_slice(&(items.len() as u32).to_le_bytes());

        buf
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_parsing() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-logo="http://example.com/logo.png" group-title="Movies",Test Movie
http://example.com/movie.mkv
#EXTINF:-1 group-title="Series",Show S01E01
http://example.com/show.mkv
"#;

        let parser = M3UParser::new(content);
        let items = parser.parse().unwrap();

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].title, "Test Movie");
        assert_eq!(items[1].title, "Show");
        assert_eq!(items[1].season, Some(1));
        assert_eq!(items[1].episode, Some(1));
    }

    #[test]
    fn test_year_extraction() {
        let content = r#"#EXTM3U
#EXTINF:-1 group-title="Movies",Great Movie (2022)
http://example.com/movie.mkv
"#;

        let parser = M3UParser::new(content);
        let items = parser.parse().unwrap();

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Great Movie");
        assert_eq!(items[0].year, Some(2022));
        assert_eq!(items[0].category, Category::Movie);
    }

    #[test]
    fn test_series_with_year() {
        let content = r#"#EXTM3U
#EXTINF:-1 group-title="Series",Amazing Show (2023) S02E05
http://example.com/show.mkv
"#;

        let parser = M3UParser::new(content);
        let items = parser.parse().unwrap();

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Amazing Show");
        assert_eq!(items[0].year, Some(2023));
        assert_eq!(items[0].season, Some(2));
        assert_eq!(items[0].episode, Some(5));
        assert_eq!(items[0].category, Category::Series);
    }
}
