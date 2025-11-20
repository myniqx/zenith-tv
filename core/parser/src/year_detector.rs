use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    /// Regex pattern for year detection (1900-2099)
    /// Matches: (2022), 2022, [2022], etc.
    static ref YEAR_PATTERN: Regex = Regex::new(r"(19|20)\d{2}").unwrap();
}

/// Result of year detection
#[derive(Debug, Clone, PartialEq)]
pub struct YearInfo {
    pub year: u32,
    pub cleaned_title: String,
}

/// Detect and extract year from title, returning cleaned title
///
/// Scans for 4-digit years starting with 19 or 20.
/// Removes year and surrounding parentheses/brackets from title.
///
/// Examples:
/// - "Movie Name (2022)" -> YearInfo { year: 2022, cleaned_title: "Movie Name" }
/// - "Show 2023 Episode" -> YearInfo { year: 2023, cleaned_title: "Show Episode" }
/// - "Old Film [1999]" -> YearInfo { year: 1999, cleaned_title: "Old Film" }
pub fn detect_year(title: &str) -> Option<YearInfo> {
    let captures = YEAR_PATTERN.find(title)?;
    let year_str = captures.as_str();
    let year: u32 = year_str.parse().ok()?;

    // Find the position of the year in the title
    let year_start = captures.start();
    let year_end = captures.end();

    // Try to remove surrounding parentheses/brackets
    let mut clean_start = year_start;
    let mut clean_end = year_end;

    let title_bytes = title.as_bytes();

    // Check for opening bracket/paren before year
    if year_start > 0 {
        let prev_char = title_bytes[year_start - 1];
        if prev_char == b'(' || prev_char == b'[' {
            clean_start = year_start - 1;
        }
    }

    // Check for closing bracket/paren after year
    if year_end < title.len() {
        let next_char = title_bytes[year_end];
        if next_char == b')' || next_char == b']' {
            clean_end = year_end + 1;
        }
    }

    // Build cleaned title by removing the year and its delimiters
    let mut cleaned = String::with_capacity(title.len());

    if clean_start > 0 {
        cleaned.push_str(&title[..clean_start]);
    }

    if clean_end < title.len() {
        cleaned.push_str(&title[clean_end..]);
    }

    // Trim whitespace and clean up double spaces
    let cleaned_title = cleaned
        .trim()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    Some(YearInfo {
        year,
        cleaned_title,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_year_in_parentheses() {
        let info = detect_year("Müzede Bir Gece: Kahmunrah'ın Yükselişi (2022)").unwrap();
        assert_eq!(info.year, 2022);
        assert_eq!(info.cleaned_title, "Müzede Bir Gece: Kahmunrah'ın Yükselişi");
    }

    #[test]
    fn test_year_in_brackets() {
        let info = detect_year("Old Movie [1999]").unwrap();
        assert_eq!(info.year, 1999);
        assert_eq!(info.cleaned_title, "Old Movie");
    }

    #[test]
    fn test_year_standalone() {
        let info = detect_year("Movie 2023 Title").unwrap();
        assert_eq!(info.year, 2023);
        assert_eq!(info.cleaned_title, "Movie Title");
    }

    #[test]
    fn test_year_at_end() {
        let info = detect_year("Some Film 2020").unwrap();
        assert_eq!(info.year, 2020);
        assert_eq!(info.cleaned_title, "Some Film");
    }

    #[test]
    fn test_no_year() {
        assert!(detect_year("No Year Movie").is_none());
        assert!(detect_year("Episode S01E01").is_none());
    }

    #[test]
    fn test_year_range_1900s() {
        let info = detect_year("Classic (1950)").unwrap();
        assert_eq!(info.year, 1950);
        assert_eq!(info.cleaned_title, "Classic");
    }

    #[test]
    fn test_year_range_2000s() {
        let info = detect_year("Recent [2099]").unwrap();
        assert_eq!(info.year, 2099);
        assert_eq!(info.cleaned_title, "Recent");
    }

    #[test]
    fn test_invalid_year() {
        // Years outside 1900-2099 range should not match
        assert!(detect_year("Future 2100").is_none());
        assert!(detect_year("Ancient 1899").is_none());
    }

    #[test]
    fn test_multiple_years_takes_first() {
        let info = detect_year("Movie (2020) Remake of (1980)").unwrap();
        assert_eq!(info.year, 2020);
        // Should only remove first year occurrence
        assert!(info.cleaned_title.contains("1980"));
    }

    #[test]
    fn test_unicode_title() {
        let info = detect_year("Türkçe Film (2021)").unwrap();
        assert_eq!(info.year, 2021);
        assert_eq!(info.cleaned_title, "Türkçe Film");
    }
}
