import { useState, useCallback, useRef } from 'react';

export interface ToastItem {
  id: string;
  type: string;
  message: string;
  durationMs?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: string, message: string, durationMs: number = 3000) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message, durationMs }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
