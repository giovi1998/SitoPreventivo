import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

afterEach(() => cleanup());

// Isolamento storage tra test: nessun file semina localStorage/sessionStorage
// in beforeAll (verificato 2026-07-30), quindi il reset globale è sicuro.
beforeEach(() => {
  // Guard: alcuni test (es. viteDevProxy) girano in environment node.
  if (typeof localStorage !== 'undefined') localStorage.clear();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
});
