import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Replicate __dirname functionality safely in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // Points '@' directly to your root directory
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Respects the AI Studio agent editing environment flags
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      
      // Recommended: Expose a clean fallback port matching your Express backend setup
      port: 5173, 
      proxy: {
        // Automatically proxies API calls to your Express backend during development
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});