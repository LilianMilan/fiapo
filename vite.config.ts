import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // No GitHub Pages o site fica em /fiapo/
  base: command === 'build' ? '/fiapo/' : '/',
  plugins: [react()],
  server: {
    open: true,
  },
}))
