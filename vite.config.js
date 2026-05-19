import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Treat .glb/.gltf as binary assets so Vite copies them and returns a URL
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  base: './',
  optimizeDeps: {
    include: ['uqr'],
  },
  server: {
    port: 5173,
    open: false,
  },
})
