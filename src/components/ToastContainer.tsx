import React, { useEffect } from 'react';
import type { ToastItem } from '../hooks/useToast';

const TOAST_COLORS: Record<string, { bg: string; icon: string }> = {
  success: { bg: '#059669', icon: '✓' },
  warning: { bg: '#D97706', icon: '⚠' },
  error: { bg: '#DC2626', icon: '✕' },
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const c = TOAST_COLORS[toast.type] || TOAST_COLORS.success;
  return (
    <div onClick={() => onDismiss(toast.id)} className="toast" style={{ background: c.bg }}>
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{c.icon}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
