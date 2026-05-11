import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Treat .glb/.gltf as binary assets so Vite copies them and returns a URL
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  base: './',
  server: {
    port: 5173,
    open: false,
  },
})
