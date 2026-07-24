import { useState, useEffect } from 'react';

/**
 * Breakpoint canonici (Phase 13b, REQ-UX-006):
 * - BP_SHELL (768px): shell app (drawer hamburger vs sidebar)
 * - BP_WORKSPACE (1024px): workspace editor (colonne vs stack)
 *
 * I breakpoint storici sparsi (900/1100/1400…) restano nei fogli CSS e
 * vengono migrati progressivamente verso questi due valori. Codice nuovo:
 * usare SEMPRE queste costanti.
 */
export const BP_SHELL = 768;
export const BP_WORKSPACE = 1024;

export const MQ_SHELL = `(max-width: ${BP_SHELL - 1}px)`;
export const MQ_WORKSPACE = `(max-width: ${BP_WORKSPACE - 1}px)`;

/** true sotto BP_SHELL: shell mobile (drawer hamburger). */
export function useIsMobileShell(): boolean {
  return useMediaQuery(MQ_SHELL);
}

/** true sotto BP_WORKSPACE: workspace mobile/stack (editor a una colonna). */
export function useIsMobileWorkspace(): boolean {
  return useMediaQuery(MQ_WORKSPACE);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}
