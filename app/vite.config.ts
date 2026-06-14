import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/mcp': 'http://localhost:8787',
      '/test-bridges': 'http://localhost:8787',
      '/test-rssbridge': 'http://localhost:8787',
      '/test-rsshub': 'http://localhost:8787',
      '/instagram': 'http://localhost:8787',
      '/telegram': 'http://localhost:8787',
      '/health': 'http://localhost:8787',
    }
  }
})
