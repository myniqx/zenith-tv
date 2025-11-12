use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

mod parser;
mod categorizer;
mod episode_detector;
mod category_tree;

pub use parser::M3UParser;
pub use categorizer::{Category, categorize_item};
pub use episode_detector::{Episode, detect_episode};
pub use category_tree::{CategoryTree, CategoryNode};

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

/// Parse M3U content and return a category tree
#[wasm_bindgen]
pub fn parse_m3u_with_tree(content: &str) -> Result<CategoryTree, JsValue> {
    let parser = M3UParser::new(content);
    match parser.parse() {
        Ok(items) => Ok(CategoryTree::build(items)),
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
        assert_eq!(items[1].title, "Show S01E01");
    }
}
