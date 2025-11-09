use crate::{categorize_item, M3UItem};

/// High-performance streaming M3U parser
pub struct M3UParser<'a> {
    content: &'a str,
    cursor: usize,
}

impl<'a> M3UParser<'a> {
    pub fn new(content: &'a str) -> Self {
        Self { content, cursor: 0 }
    }

    /// Parse M3U content into items
    pub fn parse(&self) -> Result<Vec<M3UItem>, String> {
        let mut parser = Self::new(self.content);

        // Verify header
        if !parser.read_header()? {
            return Err("Invalid M3U file: missing #EXTM3U header".to_string());
        }

        let mut items = Vec::new();

        // Parse entries
        while let Some((metadata_line, url_line)) = parser.read_entry() {
            if let Some(item) = parser.parse_entry(metadata_line, url_line) {
                items.push(item);
            }
        }

        Ok(items)
    }

    /// Read and verify M3U header
    fn read_header(&mut self) -> Result<bool, String> {
        if let Some(line) = self.read_line() {
            Ok(line.trim().starts_with("#EXTM3U"))
        } else {
            Err("Empty file".to_string())
        }
    }

    /// Read next entry (metadata line + URL line)
    fn read_entry(&mut self) -> Option<(&'a str, &'a str)> {
        // Skip empty lines and comments (except #EXTINF)
        let metadata = loop {
            let line = self.read_line()?;
            let trimmed = line.trim();

            if trimmed.starts_with("#EXTINF") {
                break line;
            }

            // Skip other comments and empty lines
            if trimmed.is_empty() || (trimmed.starts_with('#') && !trimmed.starts_with("#EXTINF")) {
                continue;
            }

            // If we hit a non-comment, non-empty line without #EXTINF, skip it
            // This handles malformed entries
        };

        // Read URL line
        let url = loop {
            let line = self.read_line()?;
            let trimmed = line.trim();

            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                break line;
            }
        };

        Some((metadata, url))
    }

    /// Parse single entry
    fn parse_entry(&self, metadata: &'a str, url: &'a str) -> Option<M3UItem> {
        let url = url.trim();

        // Parse #EXTINF line
        // Format: #EXTINF:duration tvg-logo="..." group-title="..." ,Title

        let comma_pos = metadata.rfind(',')?;
        let title = metadata[comma_pos + 1..].trim().to_string();
        let attributes = &metadata[..comma_pos];

        let mut logo = None;
        let mut group = String::new();

        // Simple attribute parsing (can be optimized with proper parser)
        if let Some(logo_start) = attributes.find("tvg-logo=\"") {
            let logo_value_start = logo_start + 10;
            if let Some(logo_end) = attributes[logo_value_start..].find('"') {
                logo = Some(attributes[logo_value_start..logo_value_start + logo_end].to_string());
            }
        }

        if let Some(group_start) = attributes.find("group-title=\"") {
            let group_value_start = group_start + 13;
            if let Some(group_end) = attributes[group_value_start..].find('"') {
                group = attributes[group_value_start..group_value_start + group_end].to_string();
            }
        }

        let category = categorize_item(&title, url);

        Some(M3UItem {
            title,
            url: url.to_string(),
            group,
            logo,
            category,
        })
    }

    /// Read next line
    fn read_line(&mut self) -> Option<&'a str> {
        if self.cursor >= self.content.len() {
            return None;
        }

        let start = self.cursor;
        let remaining = &self.content[start..];

        // Find line end
        let end = if let Some(pos) = remaining.find('\n') {
            self.cursor = start + pos + 1;
            start + pos
        } else {
            // Last line without newline
            self.cursor = self.content.len();
            self.content.len()
        };

        let line = &self.content[start..end];

        // Handle \r\n
        Some(line.trim_end_matches('\r'))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_parsing() {
        let parser = M3UParser::new("#EXTM3U\n");
        assert!(parser.parse().is_ok());
    }

    #[test]
    fn test_invalid_header() {
        let parser = M3UParser::new("Invalid\n");
        assert!(parser.parse().is_err());
    }

    #[test]
    fn test_entry_parsing() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-logo="http://example.com/logo.png" group-title="Movies",Test Movie
http://example.com/movie.mkv
"#;
        let parser = M3UParser::new(content);
        let items = parser.parse().unwrap();

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Test Movie");
        assert_eq!(items[0].group, "Movies");
        assert_eq!(items[0].logo, Some("http://example.com/logo.png".to_string()));
    }
}
