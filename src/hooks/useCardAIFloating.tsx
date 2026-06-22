import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { AILogEntry } from '../ai/types';

interface CardAIFloatingState {
  isOpen: boolean;
  hasUnread: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  pushLog: (log: AILogEntry) => void;
  clearUnread: () => void;
}

const CardAIFloatingContext = createContext<CardAIFloatingState | null>(null);

export function CardAIFloatingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setHasUnread(false);
      return !prev;
    });
  }, []);

  const pushLog = useCallback((_log: AILogEntry) => {
    setHasUnread((prev) => prev || true);
  }, []);

  const clearUnread = useCallback(() => {
    setHasUnread(false);
  }, []);

  const value = useMemo<CardAIFloatingState>(
    () => ({ isOpen, hasUnread, open, close, toggle, pushLog, clearUnread }),
    [isOpen, hasUnread, open, close, toggle, pushLog, clearUnread],
  );

  return <CardAIFloatingContext.Provider value={value}>{children}</CardAIFloatingContext.Provider>;
}

export function useCardAIFloating(): CardAIFloatingState {
  const ctx = useContext(CardAIFloatingContext);
  if (!ctx) {
    throw new Error('useCardAIFloating must be used within a CardAIFloatingProvider');
  }
  return ctx;
}
