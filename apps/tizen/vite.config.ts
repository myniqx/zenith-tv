import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2015',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          parser: ['@zenith-tv/parser'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@navix/core': resolve(__dirname, '../../..', 'navix/packages/core/src/index.ts'),
      '@navix/react': resolve(__dirname, '../../..', 'navix/packages/react/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
