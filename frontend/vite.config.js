import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const proxyURL = 'http://localhost:8000';
// const proxyURL = process.env.proxyURL;

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {  
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
            target: proxyURL,
            changeOrigin: true,
            secure: false,
        },
        '/token/': {
            target: proxyURL,
            changeOrigin: true,
            secure: false,
        },
        '/logout/': {
            target: proxyURL,
            changeOrigin: true,
            secure: false,
        }
      }
    }
}})

