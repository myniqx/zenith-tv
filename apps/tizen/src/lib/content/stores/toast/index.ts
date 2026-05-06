import { create } from 'zustand';
import type { ToastState } from './types';

export * from './types';

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);

    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  success: (message, duration) => {
    useToastStore.getState().addToast('success', message, duration);
  },

  error: (message, duration) => {
    useToastStore.getState().addToast('error', message, duration);
  },

  info: (message, duration) => {
    useToastStore.getState().addToast('info', message, duration);
  },

  warning: (message, duration) => {
    useToastStore.getState().addToast('warning', message, duration);
  },
}));
