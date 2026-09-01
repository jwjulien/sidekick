/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [solid({ hot: process.env.VITEST ? false : true })],
  clearScreen: false,
  optimizeDeps: {
    include: ['lucide-solid', '@solidjs/router', 'solid-toast'],
  },
  server: {
    host: host || true,
    port: 5173,
    strictPort: true,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 5173,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
})

