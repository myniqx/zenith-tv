import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/**/tests/**/*.test.ts', 'shared/**/tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@zenith-tv/content': path.resolve(__dirname, 'shared/content/src/index.ts'),
      '@': path.resolve(__dirname, 'apps/desktop/src'),
    },
  },
});
