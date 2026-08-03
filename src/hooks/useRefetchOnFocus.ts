import { useEffect } from 'react';

export function useRefetchOnFocus(fn: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fn();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fn]);
}
