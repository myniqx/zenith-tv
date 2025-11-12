const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class ZenithDatabase {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database
   */
  init() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'zenith-tv.db');

    console.log(`[DB] Opening database at: ${dbPath}`);
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Load and execute schema
    this.createTables();

    console.log('[DB] Database initialized successfully');
  }

  /**
   * Create database tables
   */
  createTables() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema (SQLite executes multiple statements)
    this.db.exec(schema);
  }

  /**
   * Get all profiles
   */
  getProfiles() {
    const stmt = this.db.prepare(`
      SELECT * FROM profiles ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  /**
   * Add a new profile
   */
  addProfile(name, m3uUrl) {
    const stmt = this.db.prepare(`
      INSERT INTO profiles (name, m3u_url)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, m3uUrl);
    return result.lastInsertRowid;
  }

  /**
   * Delete a profile
   */
  deleteProfile(id) {
    const stmt = this.db.prepare('DELETE FROM profiles WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Update profile last sync time and item count
   */
  updateProfileSync(profileId, itemCount) {
    const stmt = this.db.prepare(`
      UPDATE profiles
      SET last_sync = datetime('now'), item_count = ?
      WHERE id = ?
    `);
    stmt.run(itemCount, profileId);
  }

  /**
   * Get all items for a profile
   */
  getItemsByProfile(profileId) {
    const stmt = this.db.prepare(`
      SELECT
        i.*,
        s.series_name, s.season, s.episode,
        f.item_url IS NOT NULL as is_favorite,
        w.position, w.duration, w.last_watched, w.completed
      FROM items i
      LEFT JOIN series s ON i.url = s.item_url
      LEFT JOIN favorites f ON i.url = f.item_url
      LEFT JOIN watch_history w ON i.url = w.item_url
      WHERE i.profile_id = ?
      ORDER BY i.added_date DESC
    `);
    return stmt.all(profileId);
  }

  /**
   * Add or update multiple items
   */
  upsertItems(profileId, items) {
    const insertItem = this.db.prepare(`
      INSERT OR REPLACE INTO items
      (url, title, group_name, logo, category_type, profile_id, added_date)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertSeries = this.db.prepare(`
      INSERT OR REPLACE INTO series (item_url, series_name, season, episode)
      VALUES (?, ?, ?, ?)
    `);

    const checkExisting = this.db.prepare(`
      SELECT url FROM items WHERE url = ?
    `);

    const newItems = [];

    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        const exists = checkExisting.get(item.url);
        const isNew = !exists;

        insertItem.run(
          item.url,
          item.title,
          item.group,
          item.logo || null,
          item.category.type,
          profileId
        );

        if (item.category.type === 'series' && item.category.episode) {
          insertSeries.run(
            item.url,
            item.category.episode.seriesName,
            item.category.episode.season,
            item.category.episode.episode
          );
        }

        if (isNew) {
          newItems.push(item.url);
        }
      }
    });

    transaction(items);
    return newItems;
  }

  /**
   * Add items to recent list
   */
  addToRecent(itemUrls) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO recent_items (item_url, added_date)
      VALUES (?, datetime('now'))
    `);

    const transaction = this.db.transaction((urls) => {
      for (const url of urls) {
        stmt.run(url);
      }
    });

    transaction(itemUrls);
  }

  /**
   * Get recent items (last 30 days)
   */
  getRecentItems(profileId) {
    const stmt = this.db.prepare(`
      SELECT i.*, r.added_date as recent_date
      FROM recent_items r
      JOIN items i ON r.item_url = i.url
      WHERE i.profile_id = ?
        AND r.added_date > datetime('now', '-30 days')
      ORDER BY r.added_date DESC
    `);
    return stmt.all(profileId);
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(itemUrl) {
    const check = this.db.prepare('SELECT item_url FROM favorites WHERE item_url = ?');
    const exists = check.get(itemUrl);

    if (exists) {
      const stmt = this.db.prepare('DELETE FROM favorites WHERE item_url = ?');
      stmt.run(itemUrl);
      return false;
    } else {
      const stmt = this.db.prepare('INSERT INTO favorites (item_url) VALUES (?)');
      stmt.run(itemUrl);
      return true;
    }
  }

  /**
   * Get favorites for a profile
   */
  getFavorites(profileId) {
    const stmt = this.db.prepare(`
      SELECT i.*, f.added_date as favorite_date
      FROM favorites f
      JOIN items i ON f.item_url = i.url
      WHERE i.profile_id = ?
      ORDER BY f.added_date DESC
    `);
    return stmt.all(profileId);
  }

  /**
   * Save watch progress
   */
  saveWatchProgress(itemUrl, position, duration) {
    const completed = position / duration > 0.9;

    const stmt = this.db.prepare(`
      INSERT INTO watch_history (item_url, position, duration, last_watched, completed)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(item_url) DO UPDATE SET
        position = excluded.position,
        duration = excluded.duration,
        last_watched = excluded.last_watched,
        completed = excluded.completed
    `);

    stmt.run(itemUrl, position, duration, completed ? 1 : 0);
  }

  /**
   * Get watch history
   */
  getWatchHistory(itemUrl) {
    const stmt = this.db.prepare(`
      SELECT * FROM watch_history WHERE item_url = ?
    `);
    return stmt.get(itemUrl);
  }

  /**
   * Get M3U from cache
   */
  getM3UCache(url) {
    const stmt = this.db.prepare(`
      SELECT * FROM m3u_cache
      WHERE url = ? AND datetime(expires_at) > datetime('now')
    `);
    return stmt.get(url);
  }

  /**
   * Save M3U to cache
   */
  saveM3UCache(url, content, etag, lastModified, expiresInHours = 24) {
    const stmt = this.db.prepare(`
      INSERT INTO m3u_cache (url, content, etag, last_modified, expires_at)
      VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' hours'))
      ON CONFLICT(url) DO UPDATE SET
        content = excluded.content,
        etag = excluded.etag,
        last_modified = excluded.last_modified,
        cached_at = datetime('now'),
        expires_at = excluded.expires_at
    `);
    stmt.run(url, content, etag, lastModified, expiresInHours);
  }

  /**
   * Invalidate M3U cache for a URL
   */
  invalidateM3UCache(url) {
    const stmt = this.db.prepare('DELETE FROM m3u_cache WHERE url = ?');
    stmt.run(url);
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const stmt = this.db.prepare(`
      DELETE FROM m3u_cache WHERE datetime(expires_at) <= datetime('now')
    `);
    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`[DB] Cleaned ${result.changes} expired cache entries`);
    }
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('[DB] Database closed');
    }
  }
}

// Singleton instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new ZenithDatabase();
  }
  return dbInstance;
}

module.exports = { getDatabase };
