use regex::Regex;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

/// Episode information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Episode {
    pub series_name: String,
    pub season: u32,
    pub episode: u32,
}

lazy_static! {
    /// Regex patterns for episode detection
    /// Matches: S01E01, S1E1, 1x01, 1x1, Season 1 Episode 1, etc.
    static ref PATTERNS: Vec<Regex> = vec![
        // S01E01, S1E1
        Regex::new(r"(?i)s(\d{1,2})e(\d{1,2})").unwrap(),
        // 1x01, 1x1
        Regex::new(r"(?i)(\d{1,2})x(\d{1,2})").unwrap(),
        // Season 1 Episode 1
        Regex::new(r"(?i)season\s*(\d{1,2})\s*episode\s*(\d{1,2})").unwrap(),
        // S01 E01 (with space)
        Regex::new(r"(?i)s\s*(\d{1,2})\s*e\s*(\d{1,2})").unwrap(),
    ];
}

/// Detect episode information from title
pub fn detect_episode(title: &str) -> Option<Episode> {
    for pattern in PATTERNS.iter() {
        if let Some(captures) = pattern.captures(title) {
            let season = captures.get(1)?.as_str().parse().ok()?;
            let episode = captures.get(2)?.as_str().parse().ok()?;

            // Extract series name (everything before the match)
            let match_start = captures.get(0)?.start();
            let series_name = title[..match_start].trim().to_string();

            // If series name is empty, use full title
            let series_name = if series_name.is_empty() {
                title.to_string()
            } else {
                series_name
            };

            return Some(Episode {
                series_name,
                season,
                episode,
            });
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_s01e01_format() {
        let ep = detect_episode("Show Name S01E01").unwrap();
        assert_eq!(ep.series_name, "Show Name");
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 1);
    }

    #[test]
    fn test_1x01_format() {
        let ep = detect_episode("Another Show 1x05").unwrap();
        assert_eq!(ep.series_name, "Another Show");
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 5);
    }

    #[test]
    fn test_season_episode_format() {
        let ep = detect_episode("Cool Series Season 2 Episode 10").unwrap();
        assert_eq!(ep.series_name, "Cool Series");
        assert_eq!(ep.season, 2);
        assert_eq!(ep.episode, 10);
    }

    #[test]
    fn test_no_match() {
        assert!(detect_episode("Just a Movie").is_none());
        assert!(detect_episode("Live Channel").is_none());
    }

    #[test]
    fn test_case_insensitive() {
        assert!(detect_episode("show s01e01").is_some());
        assert!(detect_episode("show S01E01").is_some());
        assert!(detect_episode("show S01e01").is_some());
    }
}
