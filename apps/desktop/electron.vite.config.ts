import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'
import path from 'path';
import fs from 'fs';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      // Copy VLC child process files to build output
      {
        name: 'copy-vlc-files',
        writeBundle() {
          const srcVlcDir = path.resolve(__dirname, 'electron/vlc');
          const destVlcDir = path.resolve(__dirname, 'out/main/vlc');

          // Create vlc directory in output
          if (!fs.existsSync(destVlcDir)) {
            fs.mkdirSync(destVlcDir, { recursive: true });
          }

          // Copy VLC child process files
          const filesToCopy = [
            'messageProtocol.cjs',
            'vlcWrapper.cjs',
            'vlcProcessManager.cjs'
          ];

          filesToCopy.forEach(file => {
            const src = path.join(srcVlcDir, file);
            const dest = path.join(destVlcDir, file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
              console.log(`[Build] Copied ${file} to ${destVlcDir}`);
            }
          });
        }
      }
    ],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/main.cjs'),
        },
        external: [
          // Native VLC module must not be bundled - use regex patterns
          /vlc-player/,
          /vlc_player\.node/,
        ],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'electron/preload.cjs'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['react-window'],
    },
    server: {
      port: 5173,
    },
  },
});
