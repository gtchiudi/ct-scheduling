import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const webURL = 'https://gtchiudi.pythonanywhere.com/';
const localURL = 'http://localhost:8000/';
const url = localURL;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  build: {
    manifest: true,
    rollupOptions: {
      input: './src/main.jsx',
    },
  },
  
  server: {
    proxy: {
      '/api': {
          target: url,
          changeOrigin: true,
          secure: false,
      },
      '/token/': {
          target: url,
          changeOrigin: true,
          secure: false,
      },
      '/logout/': {
          target: url,
          changeOrigin: true,
          secure: false,
      }
    }
  }
})

