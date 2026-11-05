import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base relativo: funciona em qualquer nome de repositório no GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
})
