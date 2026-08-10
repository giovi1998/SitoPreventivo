import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    testTimeout: 30000, // 30s — API tests re-import 6 server modules via vi.resetModules(); 15s too tight in parallel
    hookTimeout: 15000,
    exclude: ['node_modules/**', 'e2e/**', 'playwright.config.ts', 'dist/**', 'scripts/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}',
        'server.ts',
      ],
      exclude: [
        'src/**/__tests__/**',
        'src/test-setup.ts',
        'src/types/**',
        'src/main.tsx',
        '**/*.d.ts',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
