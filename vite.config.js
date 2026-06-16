import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          if (url === '/app') {
            req.url = '/index.html';
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 8000,
    open: true
  },
  optimizeDeps: {
    include: ['pdfmake']
  }
});