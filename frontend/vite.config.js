import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const debug = true
const proxyURL = debug ? 'http://localhost:8000' : '';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    assetsDir: 'assets',
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    proxy: {
      '/api': {
        target: debug ? proxyURL : process.env.proxyURL,
        changeOrigin: true,
        secure: false,
      },
      '/token/': {
        target: debug ? proxyURL : process.env.proxyURL,
        changeOrigin: true,
        secure: false,
      },
      '/logout/': {
        target: debug ? proxyURL : process.env.proxyURL,
        changeOrigin: true,
        secure: false,
      },
      '/admin/': {
        target: debug ? proxyURL : process.env.proxyURL,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

