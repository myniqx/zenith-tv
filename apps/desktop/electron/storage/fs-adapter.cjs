const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

/**
 * File System Adapter for Desktop (Electron)
 * Provides cross-platform file operations with proper error handling
 */
class FileSystemAdapter {
  constructor() {
    // Use Electron's userData path (persistent, never cleared by OS)
    this.basePath = app.getPath('userData');
    this.initialized = false;
  }

  /**
   * Initialize storage directories
   */
  async init() {
    if (this.initialized) return;

    const dirs = [
      'profiles',      // Profile metadata
      'cache',         // M3U cache files
      'user-data',     // User preferences (favorites, watch history)
    ];

    for (const dir of dirs) {
      const dirPath = path.join(this.basePath, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }

    this.initialized = true;
    console.log('[Storage] Initialized at:', this.basePath);
  }

  /**
   * Read text file
   */
  async readText(relativePath) {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Write text file
   */
  async writeText(relativePath, content) {
    const fullPath = path.join(this.basePath, relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write atomically (write to temp, then rename)
    const tempPath = `${fullPath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, fullPath);
  }

  /**
   * Read JSON file
   */
  async readJSON(relativePath) {
    const content = await this.readText(relativePath);
    return content ? JSON.parse(content) : null;
  }

  /**
   * Write JSON file
   */
  async writeJSON(relativePath, data) {
    const content = JSON.stringify(data, null, 2);
    await this.writeText(relativePath, content);
  }

  /**
   * Check if file exists
   */
  async exists(relativePath) {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  async delete(relativePath) {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Already deleted
      }
      throw error;
    }
  }

  /**
   * Get file stats (size, modified date)
   */
  async getStats(relativePath) {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        modifiedAt: stats.mtime.getTime(),
        createdAt: stats.birthtime.getTime(),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List files in directory
   */
  async listFiles(relativePath) {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      return await fs.readdir(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get full path (for debugging)
   */
  getFullPath(relativePath) {
    return path.join(this.basePath, relativePath);
  }
}

// Singleton instance
let instance = null;

function getFileSystemAdapter() {
  if (!instance) {
    instance = new FileSystemAdapter();
  }
  return instance;
}

module.exports = { FileSystemAdapter, getFileSystemAdapter };
