import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        // Migración única desde el SW autoUpdate anterior; ver public/sw-migracion.js.
        importScripts: ['sw-migracion.js'],
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//, /^\/storage\//],
        // Solo precache de assets locales; jamás respuestas financieras ni Storage.
        runtimeCaching: [],
      },
      manifest: {
        name: 'ÑandeFinanza - Finanzas en Pareja',
        short_name: 'ÑandeFinanza',
        description: 'Gestión de gastos compartidos con IA y Multimoneda',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
