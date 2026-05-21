import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
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
