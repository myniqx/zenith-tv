use serde::{Deserialize, Serialize};
use crate::episode_detector::detect_episode;
use crate::year_detector::detect_year;

/// Content category (simplified - episode info moved to M3UItem)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum Category {
    /// Live stream (no file extension in URL)
    LiveStream,
    /// TV Series episode
    Series,
    /// Movie or standalone content
    Movie,
}

/// Result of item categorization with metadata
#[derive(Debug, Clone, PartialEq)]
pub struct CategorizedItem {
    pub category: Category,
    pub cleaned_title: String,
    pub year: Option<u32>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

/// Categorize an item based on title and URL, extracting all metadata
///
/// This function:
/// 1. Detects live streams by URL extension
/// 2. Extracts year from title and cleans it
/// 3. Detects series episodes (season/episode numbers)
/// 4. Returns category with all extracted metadata
pub fn categorize_item(title: &str, url: &str) -> CategorizedItem {
    // Check if it's a live stream (no file extension)
    if is_live_stream(url) {
        return CategorizedItem {
            category: Category::LiveStream,
            cleaned_title: title.to_string(),
            year: None,
            season: None,
            episode: None,
        };
    }

    // Try to extract year from title
    let (working_title, year) = if let Some(year_info) = detect_year(title) {
        (year_info.cleaned_title, Some(year_info.year))
    } else {
        (title.to_string(), None)
    };

    // Check if it's a series episode
    if let Some(episode_info) = detect_episode(&working_title) {
        return CategorizedItem {
            category: Category::Series,
            cleaned_title: episode_info.series_name,
            year,
            season: Some(episode_info.season),
            episode: Some(episode_info.episode),
        };
    }

    // Default to movie
    CategorizedItem {
        category: Category::Movie,
        cleaned_title: working_title,
        year,
        season: None,
        episode: None,
    }
}

/// Detect if URL is a live stream (no file extension)
fn is_live_stream(url: &str) -> bool {
    // Find last slash
    if let Some(last_slash) = url.rfind('/') {
        let filename = &url[last_slash + 1..];

        // Check if there's a dot after query params removal
        let filename_without_query = if let Some(query_pos) = filename.find('?') {
            &filename[..query_pos]
        } else {
            filename
        };

        // No extension = live stream
        !filename_without_query.contains('.')
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_live_stream_detection() {
        assert!(is_live_stream("http://example.com/stream"));
        assert!(is_live_stream("http://example.com/channels/hd1"));
        assert!(!is_live_stream("http://example.com/movie.mkv"));
        assert!(!is_live_stream("http://example.com/video.mp4"));
    }

    #[test]
    fn test_series_categorization() {
        let result = categorize_item("Show S01E01", "http://example.com/show.mkv");
        assert_eq!(result.category, Category::Series);
        assert_eq!(result.cleaned_title, "Show");
        assert_eq!(result.season, Some(1));
        assert_eq!(result.episode, Some(1));
    }

    #[test]
    fn test_movie_categorization() {
        let result = categorize_item("Movie Title", "http://example.com/movie.mkv");
        assert_eq!(result.category, Category::Movie);
        assert_eq!(result.cleaned_title, "Movie Title");
    }

    #[test]
    fn test_live_stream_categorization() {
        let result = categorize_item("Live Channel", "http://example.com/channel1");
        assert_eq!(result.category, Category::LiveStream);
    }

    #[test]
    fn test_movie_with_year() {
        let result = categorize_item(
            "Müzede Bir Gece: Kahmunrah'ın Yükselişi (2022)",
            "http://example.com/movie.mkv"
        );
        assert_eq!(result.category, Category::Movie);
        assert_eq!(result.cleaned_title, "Müzede Bir Gece: Kahmunrah'ın Yükselişi");
        assert_eq!(result.year, Some(2022));
    }

    #[test]
    fn test_series_with_year() {
        let result = categorize_item("Show Name (2023) S01E05", "http://example.com/show.mkv");
        assert_eq!(result.category, Category::Series);
        assert_eq!(result.cleaned_title, "Show Name");
        assert_eq!(result.year, Some(2023));
        assert_eq!(result.season, Some(1));
        assert_eq!(result.episode, Some(5));
    }
}
