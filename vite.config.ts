import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Electron loads dist/index.html via file://, so it needs relative asset paths.
  // The web deployment is served from the domain root and needs BrowserRouter
  // (nested paths like /practice/:id) to resolve assets absolutely.
  base: mode === 'electron' ? './' : '/',
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
          'vendor-store': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001',
        changeOrigin: true,
      },
    },
  },
}))
