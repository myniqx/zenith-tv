/**
 * Diff Calculator
 * Compares old and new M3U content to detect changes
 */
class DiffCalculator {
  /**
   * Parse M3U content into simple item list
   * Returns array of { url, title, group, logo }
   */
  parseM3USimple(content) {
    const lines = content.split('\n');
    const items = [];
    let currentItem = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF')) {
        // Parse metadata line
        const commaIndex = line.lastIndexOf(',');
        if (commaIndex === -1) continue;

        const title = line.substring(commaIndex + 1).trim();
        const metadata = line.substring(0, commaIndex);

        // Extract attributes
        let group = '';
        let logo = '';

        const groupMatch = metadata.match(/group-title="([^"]*)"/);
        if (groupMatch) {
          group = groupMatch[1];
        }

        const logoMatch = metadata.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) {
          logo = logoMatch[1];
        }

        currentItem = { title, group, logo, url: '' };
      } else if (currentItem && line && !line.startsWith('#')) {
        // URL line
        currentItem.url = line;
        items.push(currentItem);
        currentItem = null;
      }
    }

    return items;
  }

  /**
   * Calculate diff between old and new M3U
   * Returns { added, removed, unchanged, stats }
   */
  calculateDiff(oldContent, newContent) {
    const oldItems = this.parseM3USimple(oldContent);
    const newItems = this.parseM3USimple(newContent);

    // Create URL maps for faster lookup
    const oldMap = new Map(oldItems.map(item => [item.url, item]));
    const newMap = new Map(newItems.map(item => [item.url, item]));

    // Find added items (in new, not in old)
    const added = newItems.filter(item => !oldMap.has(item.url));

    // Find removed items (in old, not in new)
    const removed = oldItems.filter(item => !newMap.has(item.url));

    // Find unchanged items (in both)
    const unchanged = newItems.filter(item => oldMap.has(item.url));

    // Calculate statistics
    const stats = {
      totalOld: oldItems.length,
      totalNew: newItems.length,
      added: added.length,
      removed: removed.length,
      unchanged: unchanged.length,
      percentChange: oldItems.length > 0
        ? ((added.length + removed.length) / oldItems.length * 100).toFixed(2)
        : 0,
    };

    console.log(`[Diff Calculator] Changes: +${added.length} -${removed.length} =${unchanged.length}`);

    return {
      added,
      removed,
      unchanged,
      stats,
    };
  }

  /**
   * Get summary of changes for UI display
   */
  getSummary(diff) {
    const messages = [];

    if (diff.added.length > 0) {
      messages.push(`✅ ${diff.added.length} new items added`);
    }

    if (diff.removed.length > 0) {
      messages.push(`❌ ${diff.removed.length} items removed`);
    }

    if (diff.added.length === 0 && diff.removed.length === 0) {
      messages.push(`✨ No changes detected`);
    }

    return messages.join('\n');
  }

  /**
   * Get added items grouped by category
   */
  groupByCategory(items) {
    const grouped = {};

    for (const item of items) {
      const group = item.group || 'Uncategorized';

      if (!grouped[group]) {
        grouped[group] = [];
      }

      grouped[group].push(item);
    }

    return grouped;
  }
}

// Singleton instance
let instance = null;

function getDiffCalculator() {
  if (!instance) {
    instance = new DiffCalculator();
  }
  return instance;
}

module.exports = { DiffCalculator, getDiffCalculator };
