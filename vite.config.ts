import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-vexflow': ['vexflow'],
          'vendor-tone': ['tone', '@tonejs/midi'],
          'vendor-audio': ['pitchy', 'webmidi'],
          'vendor-db': ['dexie', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
