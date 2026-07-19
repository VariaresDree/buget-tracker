import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from a GitHub Pages project subpath (github.io/buget-tracker/).
  base: '/buget-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Budget Tracker',
        short_name: 'Budget',
        description: 'Offline-first personal budget tracker',
        display: 'standalone',
        background_color: '#10141c',
        theme_color: '#10141c',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    restoreMocks: true,
  },
});
