use serde::{Deserialize, Serialize};
use crate::episode_detector::{detect_episode, Episode};

/// Content category
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Category {
    /// Live stream (no file extension in URL)
    LiveStream,
    /// TV Series episode
    Series(Episode),
    /// Movie or standalone content
    Movie,
}

/// Categorize an item based on title and URL
pub fn categorize_item(title: &str, url: &str) -> Category {
    // Check if it's a live stream (no file extension)
    if is_live_stream(url) {
        return Category::LiveStream;
    }

    // Check if it's a series episode
    if let Some(episode) = detect_episode(title) {
        return Category::Series(episode);
    }

    // Default to movie
    Category::Movie
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
    fn test_categorization() {
        let cat = categorize_item("Show S01E01", "http://example.com/show.mkv");
        assert!(matches!(cat, Category::Series(_)));

        let cat = categorize_item("Movie Title", "http://example.com/movie.mkv");
        assert_eq!(cat, Category::Movie);

        let cat = categorize_item("Live Channel", "http://example.com/channel1");
        assert_eq!(cat, Category::LiveStream);
    }
}
