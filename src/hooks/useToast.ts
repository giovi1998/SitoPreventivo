import React, { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export interface ToastItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  durationMs?: number;
}

export interface UseToastReturn {
  toasts: ToastItem[];
  addToast: (type: string, message: string, durationMs?: number) => string;
  dismissToast: (id: string) => void;
}

function useLocalToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((type: string, message: string, durationMs: number = 3000) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}-${Date.now()}`;
    const safeType = (['info', 'success', 'warning', 'error'] as const).includes(type as ToastItem['type'])
      ? (type as ToastItem['type'])
      : 'info';
    setToasts((prev) => [...prev, { id, type: safeType, message, durationMs }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

const ToastContext = createContext<UseToastReturn | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value = useLocalToast();
  return React.createElement(ToastContext.Provider, { value }, children);
};

export function useToast(): UseToastReturn {
  const ctx = useContext(ToastContext);
  // Fallback keeps existing tests and any isolated hook usage working
  // without wrapping every test in ToastProvider.
  return ctx ?? useLocalToast();
}
