import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  clearScreen: false,
  define: {
    global: 'window',
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  plugins: [
    react(),
    nodePolyfills(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "fs": path.resolve(__dirname, "./fs-stub.js"),
      // Use the prebuilt browser bundle of ExcelJS (the Node entry pulls in fs/stream/buffer
      // dependencies that fail at runtime inside the Tauri webview).
      "exceljs": path.resolve(__dirname, "lib/exceljs.browser.js"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs')) {
              return 'vendor-excel';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react') || id.includes('bootstrap-icons')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
})