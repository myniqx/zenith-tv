use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

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
#[wasm_bindgen(getter_with_clone)]
pub struct M3UItem {
    #[wasm_bindgen(skip)]
    pub title: String,
    #[wasm_bindgen(skip)]
    pub url: String,
    #[wasm_bindgen(skip)]
    pub group: String,
    #[wasm_bindgen(skip)]
    pub logo: Option<String>,
    #[wasm_bindgen(skip)]
    pub category: Category,
    #[wasm_bindgen(skip)]
    pub year: Option<u32>,
    #[wasm_bindgen(skip)]
    pub season: Option<u32>,
    #[wasm_bindgen(skip)]
    pub episode: Option<u32>,
}

#[wasm_bindgen]
impl M3UItem {
    #[wasm_bindgen(getter)]
    pub fn title(&self) -> String {
        self.title.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn url(&self) -> String {
        self.url.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn group(&self) -> String {
        self.group.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn logo(&self) -> Option<String> {
        self.logo.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn year(&self) -> Option<u32> {
        self.year
    }

    #[wasm_bindgen(getter)]
    pub fn season(&self) -> Option<u32> {
        self.season
    }

    #[wasm_bindgen(getter)]
    pub fn episode(&self) -> Option<u32> {
        self.episode
    }
}

/// Parse M3U content and return categorized items
#[wasm_bindgen]
pub fn parse_m3u(content: &str) -> Result<JsValue, JsValue> {
    let parser = M3UParser::new(content);
    match parser.parse() {
        Ok(items) => {
            serde_wasm_bindgen::to_value(&items)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
        }
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

/// Get version information
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
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
