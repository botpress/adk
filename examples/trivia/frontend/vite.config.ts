import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@botpress/webchat/style.css': path.resolve(__dirname, './node_modules/@botpress/webchat/dist/style.css'),
    },
    dedupe: ['react', 'react-dom'],
  },
})