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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/') || id.includes('node_modules/@react-three/')) {
            return 'three';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@phosphor-icons/')) {
            return 'phosphor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
})
