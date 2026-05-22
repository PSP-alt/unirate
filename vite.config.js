import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    /* Разбиваем бандл на чанки — снижает пиковое потребление памяти при сборке */
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'recharts', 'react-hot-toast'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
