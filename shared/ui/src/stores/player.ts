/**
 * Player state store (Zustand)
 */

import { create } from 'zustand';
import type { PlayerState, WatchableItem } from '@zenith-tv/types';

interface PlayerStore extends PlayerState {
  // Actions
  play: (item: WatchableItem) => void;
  pause: () => void;
  resume: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setAudioTrack: (index: number) => void;
  setSubtitleTrack: (index: number) => void;
  updatePosition: (position: number) => void;
  updateDuration: (duration: number) => void;
  setState: (state: PlayerState['state']) => void;
  reset: () => void;
}

const initialState: PlayerState = {
  currentItem: null,
  state: 'idle',
  position: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  selectedAudioTrack: undefined,
  selectedSubtitleTrack: undefined,
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  ...initialState,

  play: (item) =>
    set({
      currentItem: item,
      state: 'loading',
      position: 0,
    }),

  pause: () =>
    set({
      state: 'paused',
    }),

  resume: () =>
    set({
      state: 'playing',
    }),

  seek: (position) =>
    set({
      position,
    }),

  setVolume: (volume) =>
    set({
      volume: Math.max(0, Math.min(1, volume)),
      isMuted: false,
    }),

  toggleMute: () =>
    set((state) => ({
      isMuted: !state.isMuted,
    })),

  setAudioTrack: (index) =>
    set({
      selectedAudioTrack: index,
    }),

  setSubtitleTrack: (index) =>
    set({
      selectedSubtitleTrack: index,
    }),

  updatePosition: (position) =>
    set({
      position,
    }),

  updateDuration: (duration) =>
    set({
      duration,
    }),

  setState: (state) =>
    set({
      state,
    }),

  reset: () =>
    set(initialState),
}));
