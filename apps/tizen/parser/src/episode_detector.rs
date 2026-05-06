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
        // S01E01, S1E1 (with optional spaces)
        Regex::new(r"(?i)s\s*(\d{1,2})\s*e\s*(\d{1,2})").unwrap(),
        // 1x01, 1x1
        Regex::new(r"(?i)(\d{1,2})x(\d{1,2})").unwrap(),
        // Season 1 Episode 1
        Regex::new(r"(?i)season\s*(\d{1,2})\s*episode\s*(\d{1,2})").unwrap(),
        // Episode 1, Ep 1, Ep. 1 (standalone, assumes season 1)
        Regex::new(r"(?i)ep(?:isode)?\.?\s*(\d{1,2})").unwrap(),
    ];
}

/// Detect episode information from title using pattern matching
///
/// This implementation follows TypeScript version's algorithm:
/// 1. Scans for S/s followed by digits (season)
/// 2. Then scans for E/e followed by digits (episode)
/// 3. Extracts series name by finding last non-whitespace before 'S'
///
/// Falls back to regex patterns if manual scan fails.
pub fn detect_episode(title: &str) -> Option<Episode> {
    // First try manual character-by-character scan (like TypeScript version)
    if let Some(ep) = detect_episode_manual(title) {
        return Some(ep);
    }

    // Fallback to regex patterns
    detect_episode_regex(title)
}

/// Manual character-by-character episode detection (TypeScript algorithm port)
fn detect_episode_manual(title: &str) -> Option<Episode> {
    let chars: Vec<char> = title.chars().collect();
    let len = chars.len();
    let mut season: Option<u32> = None;
    let mut episode: Option<u32> = None;
    let mut series_name_end: usize = 0;

    let is_digit = |ch: char| ch.is_ascii_digit();
    let is_whitespace = |ch: char| ch.is_whitespace();

    let mut i = 0;
    while i < len {
        let ch = chars[i];

        // Look for 'S' or 's' (season marker)
        if season.is_none() && (ch == 'S' || ch == 's') {
            // Try to parse following digits
            if i + 1 < len {
                let s0 = chars[i + 1];
                let s1 = if i + 2 < len { chars[i + 2] } else { '\0' };

                let parsed_season = if is_digit(s0) && is_digit(s1) {
                    // Two digits
                    Some(s0.to_digit(10)? * 10 + s1.to_digit(10)?)
                } else if is_digit(s0) {
                    // One digit
                    Some(s0.to_digit(10)?)
                } else {
                    None
                };

                if let Some(s) = parsed_season {
                    season = Some(s);

                    // Find series name end (last non-whitespace before 'S')
                    series_name_end = i;
                    while series_name_end > 0 && is_whitespace(chars[series_name_end - 1]) {
                        series_name_end -= 1;
                    }
                }
            }
        }

        // Look for 'E' or 'e' (episode marker) - only after season is found
        if season.is_some() && episode.is_none() && (ch == 'E' || ch == 'e') {
            // Try to parse following digits
            if i + 1 < len {
                let e0 = chars[i + 1];
                let e1 = if i + 2 < len { chars[i + 2] } else { '\0' };

                let parsed_episode = if is_digit(e0) && is_digit(e1) {
                    // Two digits
                    Some(e0.to_digit(10)? * 10 + e1.to_digit(10)?)
                } else if is_digit(e0) {
                    // One digit
                    Some(e0.to_digit(10)?)
                } else {
                    None
                };

                if let Some(e) = parsed_episode {
                    episode = Some(e);
                    break; // Found both season and episode
                }
            }
        }

        i += 1;
    }

    // Both season and episode must be found
    if let (Some(s), Some(e)) = (season, episode) {
        let series_name = if series_name_end > 0 {
            chars[..series_name_end].iter().collect::<String>().trim().to_string()
        } else {
            title.to_string()
        };

        Some(Episode {
            series_name,
            season: s,
            episode: e,
        })
    } else {
        None
    }
}

/// Regex-based episode detection (fallback)
fn detect_episode_regex(title: &str) -> Option<Episode> {
    for (idx, pattern) in PATTERNS.iter().enumerate() {
        if let Some(captures) = pattern.captures(title) {
            let season: u32;
            let episode: u32;

            // Pattern 3 (Episode only) - assume season 1
            if idx == 3 {
                season = 1;
                episode = captures.get(1)?.as_str().parse().ok()?;
            } else {
                season = captures.get(1)?.as_str().parse().ok()?;
                episode = captures.get(2)?.as_str().parse().ok()?;
            }

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

    #[test]
    fn test_manual_detection_single_digit() {
        let ep = detect_episode("Show S1E5").unwrap();
        assert_eq!(ep.series_name, "Show");
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 5);
    }

    #[test]
    fn test_manual_detection_double_digit() {
        let ep = detect_episode("Series Name S12E34").unwrap();
        assert_eq!(ep.series_name, "Series Name");
        assert_eq!(ep.season, 12);
        assert_eq!(ep.episode, 34);
    }

    #[test]
    fn test_episode_only_pattern() {
        let ep = detect_episode("Show Episode 5").unwrap();
        assert_eq!(ep.season, 1); // Default season
        assert_eq!(ep.episode, 5);
    }

    #[test]
    fn test_ep_abbreviation() {
        let ep = detect_episode("Series Ep 3").unwrap();
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 3);
    }
}
