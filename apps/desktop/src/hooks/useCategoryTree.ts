/**
 * React hook for managing CategoryTree from Rust WASM parser
 * Provides direct access to category tree with sticky/hidden group preferences
 */

import { useState, useEffect, useMemo } from 'react';
import { parseM3UWithCategoryTree, type CategoryTree } from '../services/m3u-parser';
import { db } from '../services/database';

interface UseCategoryTreeOptions {
  /**
   * Profile ID to load M3U content from
   */
  profileId: number | null;

  /**
   * Optional: Pre-parsed M3U content string
   */
  m3uContent?: string;
}

interface CategoryTreeState {
  /**
   * Rust WASM CategoryTree object (null if not loaded)
   */
  tree: CategoryTree | null;

  /**
   * Sticky groups (pinned to top)
   */
  stickyGroups: string[];

  /**
   * Hidden groups (filtered out)
   */
  hiddenGroups: string[];

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Error state
   */
  error: Error | null;
}

interface CategoryTreeActions {
  /**
   * Reload category tree from cached M3U content
   */
  reload: () => Promise<void>;

  /**
   * Toggle sticky state for a group
   */
  toggleSticky: (groupName: string) => void;

  /**
   * Toggle hidden state for a group
   */
  toggleHidden: (groupName: string) => void;

  /**
   * Get movie categories with current preferences applied
   */
  getMovies: () => any[];

  /**
   * Get series categories with current preferences applied
   */
  getSeries: () => any[];

  /**
   * Get live stream categories with current preferences applied
   */
  getLiveStreams: () => any[];
}

/**
 * Hook for managing category tree with sticky/hidden group preferences
 */
export function useCategoryTree(options: UseCategoryTreeOptions): CategoryTreeState & CategoryTreeActions {
  const { profileId, m3uContent } = options;

  const [tree, setTree] = useState<CategoryTree | null>(null);
  const [stickyGroups, setStickyGroups] = useState<string[]>([]);
  const [hiddenGroups, setHiddenGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load category tree from M3U content
   */
  const loadTree = async (content: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const categoryTree = await parseM3UWithCategoryTree(content);
      setTree(categoryTree);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to parse M3U');
      setError(error);
      console.error('Failed to load category tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load preferences from profile
   */
  const loadPreferences = async (profId: number) => {
    try {
      // Load sticky/hidden groups from profile (stored in profile JSON or DB)
      // For now, initialize with empty arrays - will be loaded from profile data
      setStickyGroups([]);
      setHiddenGroups([]);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  /**
   * Effect: Load tree when M3U content changes
   */
  useEffect(() => {
    if (m3uContent) {
      loadTree(m3uContent);
    }
  }, [m3uContent]);

  /**
   * Effect: Load tree from cached M3U when profile changes
   */
  useEffect(() => {
    if (profileId && !m3uContent) {
      (async () => {
        try {
          setIsLoading(true);
          setError(null);

          // Get profile to find M3U URL
          const profiles = await db.getProfiles();
          const profile = profiles.find(p => p.id === profileId);
          if (!profile) {
            throw new Error('Profile not found');
          }

          // Load cached M3U content
          const cached = await db.getM3UCache(profile.m3uUrl);
          if (cached) {
            await loadTree(cached.content);
          }

          // Load preferences
          await loadPreferences(profileId);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to load category tree');
          setError(error);
          console.error('Failed to load category tree:', error);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [profileId, m3uContent]);

  /**
   * Reload tree from cached content
   */
  const reload = async () => {
    if (profileId) {
      try {
        setIsLoading(true);
        setError(null);

        const profiles = await db.getProfiles();
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) {
          throw new Error('Profile not found');
        }

        const cached = await db.getM3UCache(profile.m3uUrl);
        if (cached) {
          await loadTree(cached.content);
        } else {
          throw new Error('No cached M3U content found');
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reload');
        setError(error);
        console.error('Failed to reload:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  /**
   * Toggle sticky group
   */
  const toggleSticky = (groupName: string) => {
    setStickyGroups((prev) => {
      if (prev.includes(groupName)) {
        return prev.filter((g) => g !== groupName);
      } else {
        return [...prev, groupName];
      }
    });
  };

  /**
   * Toggle hidden group
   */
  const toggleHidden = (groupName: string) => {
    setHiddenGroups((prev) => {
      if (prev.includes(groupName)) {
        return prev.filter((g) => g !== groupName);
      } else {
        return [...prev, groupName];
      }
    });
  };

  /**
   * Get movies with preferences applied
   */
  const getMovies = (): any[] => {
    if (!tree) return [];

    try {
      const result = tree.getMovies(stickyGroups, hiddenGroups);
      return result as any[];
    } catch (err) {
      console.error('Failed to get movies:', err);
      return [];
    }
  };

  /**
   * Get series with preferences applied
   */
  const getSeries = (): any[] => {
    if (!tree) return [];

    try {
      const result = tree.getSeries(stickyGroups, hiddenGroups);
      return result as any[];
    } catch (err) {
      console.error('Failed to get series:', err);
      return [];
    }
  };

  /**
   * Get live streams with preferences applied
   */
  const getLiveStreams = (): any[] => {
    if (!tree) return [];

    try {
      const result = tree.getLiveStreams(stickyGroups, hiddenGroups);
      return result as any[];
    } catch (err) {
      console.error('Failed to get live streams:', err);
      return [];
    }
  };

  return {
    tree,
    stickyGroups,
    hiddenGroups,
    isLoading,
    error,
    reload,
    toggleSticky,
    toggleHidden,
    getMovies,
    getSeries,
    getLiveStreams,
  };
}
