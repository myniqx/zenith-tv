use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use crate::{M3UItem, Category};

/// A category node containing items
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct CategoryNode {
    #[wasm_bindgen(skip)]
    pub name: String,
    #[wasm_bindgen(skip)]
    pub items: Vec<M3UItem>,
}

#[wasm_bindgen]
impl CategoryNode {
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }

    #[wasm_bindgen(getter, js_name = itemCount)]
    pub fn item_count(&self) -> usize {
        self.items.len()
    }

    /// Get items with filtering and sorting
    #[wasm_bindgen(js_name = getItems)]
    pub fn get_items(&self, user_prefs: JsValue) -> Result<JsValue, JsValue> {
        // Parse user preferences
        let prefs: HashMap<String, UserItemPrefs> =
            serde_wasm_bindgen::from_value(user_prefs).unwrap_or_default();

        let mut items = self.items.clone();

        // Filter hidden items
        items.retain(|item| {
            prefs.get(&item.url)
                .map(|p| !p.hidden.unwrap_or(false))
                .unwrap_or(true)
        });

        // Sort: favorites first, then alphabetically
        items.sort_by(|a, b| {
            let a_fav = prefs.get(&a.url)
                .and_then(|p| p.favorite)
                .unwrap_or(false);
            let b_fav = prefs.get(&b.url)
                .and_then(|p| p.favorite)
                .unwrap_or(false);

            match (a_fav, b_fav) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.title.to_lowercase().cmp(&b.title.to_lowercase()),
            }
        });

        serde_wasm_bindgen::to_value(&items)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

/// Category tree containing all categorized items
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct CategoryTree {
    #[wasm_bindgen(skip)]
    pub movies: Vec<CategoryNode>,
    #[wasm_bindgen(skip)]
    pub series: Vec<CategoryNode>,
    #[wasm_bindgen(skip)]
    pub live_streams: Vec<CategoryNode>,
}

#[wasm_bindgen]
impl CategoryTree {
    /// Build category tree from parsed items
    pub fn build(items: Vec<M3UItem>) -> CategoryTree {
        let mut movies_map: HashMap<String, Vec<M3UItem>> = HashMap::new();
        let mut series_map: HashMap<String, Vec<M3UItem>> = HashMap::new();
        let mut live_map: HashMap<String, Vec<M3UItem>> = HashMap::new();

        for item in items {
            let group = if item.group.is_empty() {
                "Uncategorized".to_string()
            } else {
                item.group.clone()
            };

            match &item.category {
                Category::Movie => {
                    movies_map.entry(group).or_default().push(item);
                }
                Category::Series(_) => {
                    series_map.entry(group).or_default().push(item);
                }
                Category::LiveStream => {
                    live_map.entry(group).or_default().push(item);
                }
            }
        }

        let movies = movies_map
            .into_iter()
            .map(|(name, items)| CategoryNode { name, items })
            .collect();

        let series = series_map
            .into_iter()
            .map(|(name, items)| CategoryNode { name, items })
            .collect();

        let live_streams = live_map
            .into_iter()
            .map(|(name, items)| CategoryNode { name, items })
            .collect();

        CategoryTree {
            movies,
            series,
            live_streams,
        }
    }

    /// Get movie categories with filtering and sorting
    #[wasm_bindgen(js_name = getMovies)]
    pub fn get_movies(&self, sticky_groups: JsValue, hidden_groups: JsValue) -> Result<JsValue, JsValue> {
        let sticky: Vec<String> = serde_wasm_bindgen::from_value(sticky_groups).unwrap_or_default();
        let hidden: Vec<String> = serde_wasm_bindgen::from_value(hidden_groups).unwrap_or_default();

        let mut categories = self.movies.clone();

        // Filter hidden categories
        categories.retain(|c| !hidden.contains(&c.name));

        // Sort: sticky first, then alphabetically
        categories.sort_by(|a, b| {
            let a_sticky = sticky.contains(&a.name);
            let b_sticky = sticky.contains(&b.name);

            match (a_sticky, b_sticky) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        serde_wasm_bindgen::to_value(&categories)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get series categories with filtering and sorting
    #[wasm_bindgen(js_name = getSeries)]
    pub fn get_series(&self, sticky_groups: JsValue, hidden_groups: JsValue) -> Result<JsValue, JsValue> {
        let sticky: Vec<String> = serde_wasm_bindgen::from_value(sticky_groups).unwrap_or_default();
        let hidden: Vec<String> = serde_wasm_bindgen::from_value(hidden_groups).unwrap_or_default();

        let mut categories = self.series.clone();

        // Filter hidden categories
        categories.retain(|c| !hidden.contains(&c.name));

        // Sort: sticky first, then alphabetically
        categories.sort_by(|a, b| {
            let a_sticky = sticky.contains(&a.name);
            let b_sticky = sticky.contains(&b.name);

            match (a_sticky, b_sticky) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        serde_wasm_bindgen::to_value(&categories)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get live stream categories with filtering and sorting
    #[wasm_bindgen(js_name = getLiveStreams)]
    pub fn get_live_streams(&self, sticky_groups: JsValue, hidden_groups: JsValue) -> Result<JsValue, JsValue> {
        let sticky: Vec<String> = serde_wasm_bindgen::from_value(sticky_groups).unwrap_or_default();
        let hidden: Vec<String> = serde_wasm_bindgen::from_value(hidden_groups).unwrap_or_default();

        let mut categories = self.live_streams.clone();

        // Filter hidden categories
        categories.retain(|c| !hidden.contains(&c.name));

        // Sort: sticky first, then alphabetically
        categories.sort_by(|a, b| {
            let a_sticky = sticky.contains(&a.name);
            let b_sticky = sticky.contains(&b.name);

            match (a_sticky, b_sticky) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });

        serde_wasm_bindgen::to_value(&categories)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Get all categories (for tree view)
    #[wasm_bindgen(js_name = getAllCategories)]
    pub fn get_all_categories(&self, sticky_groups: JsValue, hidden_groups: JsValue) -> Result<JsValue, JsValue> {
        #[derive(Serialize)]
        struct AllCategories {
            movies: Vec<CategoryNode>,
            series: Vec<CategoryNode>,
            live_streams: Vec<CategoryNode>,
        }

        let movies = serde_wasm_bindgen::from_value(self.get_movies(sticky_groups.clone(), hidden_groups.clone())?)?;
        let series = serde_wasm_bindgen::from_value(self.get_series(sticky_groups.clone(), hidden_groups.clone())?)?;
        let live_streams = serde_wasm_bindgen::from_value(self.get_live_streams(sticky_groups, hidden_groups)?)?;

        let all = AllCategories {
            movies,
            series,
            live_streams,
        };

        serde_wasm_bindgen::to_value(&all)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }

    /// Find category by name
    #[wasm_bindgen(js_name = findCategory)]
    pub fn find_category(&self, category_name: &str) -> Option<CategoryNode> {
        self.movies
            .iter()
            .chain(self.series.iter())
            .chain(self.live_streams.iter())
            .find(|c| c.name == category_name)
            .cloned()
    }

    /// Search across all items
    #[wasm_bindgen]
    pub fn search(&self, query: &str) -> Result<JsValue, JsValue> {
        let query_lower = query.to_lowercase();
        let mut results = Vec::new();

        for category in self.movies.iter()
            .chain(self.series.iter())
            .chain(self.live_streams.iter())
        {
            for item in &category.items {
                if item.title.to_lowercase().contains(&query_lower) {
                    results.push(item.clone());
                }
            }
        }

        serde_wasm_bindgen::to_value(&results)
            .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
    }
}

/// User preferences for an item
#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserItemPrefs {
    favorite: Option<bool>,
    hidden: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Category;

    #[test]
    fn test_category_tree_building() {
        let items = vec![
            M3UItem {
                title: "Movie 1".to_string(),
                url: "http://example.com/movie1.mkv".to_string(),
                group: "Action".to_string(),
                logo: None,
                category: Category::Movie,
            },
            M3UItem {
                title: "Movie 2".to_string(),
                url: "http://example.com/movie2.mkv".to_string(),
                group: "Action".to_string(),
                logo: None,
                category: Category::Movie,
            },
        ];

        let tree = CategoryTree::build(items);

        assert_eq!(tree.movies.len(), 1);
        assert_eq!(tree.movies[0].name, "Action");
        assert_eq!(tree.movies[0].items.len(), 2);
    }
}
