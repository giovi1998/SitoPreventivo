import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}',
        'api/**/*.{ts,tsx}',
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
        lines: 25,
        functions: 25,
        branches: 15,
        statements: 25,
      },
    },
  },
});
