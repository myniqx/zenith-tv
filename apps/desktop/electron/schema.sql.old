-- Zenith TV Database Schema

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  m3u_url TEXT NOT NULL UNIQUE,
  last_sync DATETIME,
  item_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items table (watchable content)
CREATE TABLE IF NOT EXISTS items (
  url TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  group_name TEXT,
  logo TEXT,
  category_type TEXT NOT NULL CHECK(category_type IN ('movie', 'series', 'live_stream')),
  profile_id INTEGER NOT NULL,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Series metadata table
CREATE TABLE IF NOT EXISTS series (
  item_url TEXT PRIMARY KEY,
  series_name TEXT NOT NULL,
  season INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  FOREIGN KEY (item_url) REFERENCES items(url) ON DELETE CASCADE
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  item_url TEXT PRIMARY KEY,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_url) REFERENCES items(url) ON DELETE CASCADE
);

-- Watch history table
CREATE TABLE IF NOT EXISTS watch_history (
  item_url TEXT PRIMARY KEY,
  position REAL NOT NULL DEFAULT 0,
  duration REAL NOT NULL DEFAULT 0,
  last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed BOOLEAN DEFAULT 0,
  FOREIGN KEY (item_url) REFERENCES items(url) ON DELETE CASCADE
);

-- Recent items table (for tracking new additions)
CREATE TABLE IF NOT EXISTS recent_items (
  item_url TEXT PRIMARY KEY,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_url) REFERENCES items(url) ON DELETE CASCADE
);

-- Devices table (for P2P remote control)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  trusted BOOLEAN DEFAULT 0,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- M3U cache table (for faster syncs)
CREATE TABLE IF NOT EXISTS m3u_cache (
  url TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_profile ON items(profile_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_type);
CREATE INDEX IF NOT EXISTS idx_series_name ON series(series_name);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched ON watch_history(last_watched DESC);
CREATE INDEX IF NOT EXISTS idx_recent_added ON recent_items(added_date DESC);
CREATE INDEX IF NOT EXISTS idx_m3u_cache_expires ON m3u_cache(expires_at);
