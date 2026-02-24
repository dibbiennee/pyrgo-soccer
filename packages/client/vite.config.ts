import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

const iconSizes = [72, 96, 128, 144, 192, 384, 512] as const;
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@pyrgo/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Pyrgo Soccer',
        short_name: 'Pyrgo',
        description: 'Head-to-head soccer game — play with friends online!',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#000008',
        background_color: '#000008',
        categories: ['games', 'sports'],
        icons: iconSizes.map(size => ({
          src: `/icons/icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: 'image/png',
        })),
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,woff2,png}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/characters$/,
            handler: 'StaleWhileRevalidate',
            method: 'GET',
            options: {
              cacheName: 'characters-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
            },
          },
          {
            urlPattern: /\/socket\.io/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'vendor-phaser';
          if (id.includes('CharacterCreatorScene') || id.includes('CommunityGalleryScene')) return 'scenes-extra';
        },
      },
    },
  },
});
