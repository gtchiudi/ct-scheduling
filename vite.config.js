import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
          target: 'https://gtchiudi.pythonanywhere.com/',
          changeOrigin: true,
          secure: false,
      },
      '/token/': {
          target: 'https://gtchiudi.pythonanywhere.com/',
          changeOrigin: true,
          secure: false,
      },
      '/logout/': {
          target: 'https://gtchiudi.pythonanywhere.com/',
          changeOrigin: true,
          secure: false,
      }
    }
  }
})

