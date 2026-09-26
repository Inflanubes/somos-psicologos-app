import { defineConfig } from 'vitest/config'

// Solo módulos puros de lib/ (sin React ni Supabase). El resto se prueba con
// `npm run build` y en la app.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
})
