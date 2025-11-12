/**
 * Stats Calculator
 * Calculates detailed statistics from parsed M3U items
 */
class StatsCalculator {
  /**
   * Calculate statistics from parsed items
   * @param {Array} items - Parsed M3U items from Rust parser
   */
  calculateStats(items) {
    const stats = {
      totalItems: items.length,
      movies: 0,
      series: 0,
      liveStreams: 0,
      seasons: new Set(),
      episodes: 0,
      groups: {},
      categories: {},
    };

    for (const item of items) {
      // Count by category (from Rust parser)
      const category = item.category || 'unknown';

      if (category === 'movie' || category === 'Movie') {
        stats.movies++;
      } else if (category === 'series' || category === 'Series') {
        stats.series++;

        // Count episodes and seasons
        if (item.episode) {
          stats.episodes++;

          const seasonKey = `${item.title}-S${item.episode.season || 1}`;
          stats.seasons.add(seasonKey);
        }
      } else if (category === 'live_stream' || category === 'LiveStream') {
        stats.liveStreams++;
      }

      // Count by group
      const group = item.group || 'Uncategorized';
      stats.groups[group] = (stats.groups[group] || 0) + 1;

      // Count by category name (for UI display)
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    }

    // Convert Set to count
    stats.seasons = stats.seasons.size;

    // Sort groups by count (descending)
    stats.groups = Object.fromEntries(
      Object.entries(stats.groups)
        .sort(([, a], [, b]) => b - a)
    );

    // Sort categories by count (descending)
    stats.categories = Object.fromEntries(
      Object.entries(stats.categories)
        .sort(([, a], [, b]) => b - a)
    );

    return stats;
  }

  /**
   * Get top groups (most items)
   */
  getTopGroups(stats, limit = 10) {
    return Object.entries(stats.groups)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Get category distribution for charts
   */
  getCategoryDistribution(stats) {
    return {
      labels: Object.keys(stats.categories),
      values: Object.values(stats.categories),
    };
  }

  /**
   * Get summary string for UI
   */
  getSummary(stats) {
    const parts = [];

    if (stats.movies > 0) {
      parts.push(`${stats.movies} movies`);
    }

    if (stats.series > 0) {
      parts.push(`${stats.series} series (${stats.seasons} seasons, ${stats.episodes} episodes)`);
    }

    if (stats.liveStreams > 0) {
      parts.push(`${stats.liveStreams} live streams`);
    }

    const groupCount = Object.keys(stats.groups).length;
    parts.push(`${groupCount} groups`);

    return parts.join(', ');
  }

  /**
   * Compare two stats (old vs new)
   */
  compareStats(oldStats, newStats) {
    return {
      totalItems: {
        old: oldStats.totalItems,
        new: newStats.totalItems,
        diff: newStats.totalItems - oldStats.totalItems,
      },
      movies: {
        old: oldStats.movies,
        new: newStats.movies,
        diff: newStats.movies - oldStats.movies,
      },
      series: {
        old: oldStats.series,
        new: newStats.series,
        diff: newStats.series - oldStats.series,
      },
      liveStreams: {
        old: oldStats.liveStreams,
        new: newStats.liveStreams,
        diff: newStats.liveStreams - oldStats.liveStreams,
      },
      groups: {
        old: Object.keys(oldStats.groups).length,
        new: Object.keys(newStats.groups).length,
        diff: Object.keys(newStats.groups).length - Object.keys(oldStats.groups).length,
      },
    };
  }
}

// Singleton instance
let instance = null;

function getStatsCalculator() {
  if (!instance) {
    instance = new StatsCalculator();
  }
  return instance;
}

module.exports = { StatsCalculator, getStatsCalculator };
