import { useEffect, type ReactNode } from 'react';

interface CardAIBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export default function CardAIBottomSheet({
  isOpen,
  onClose,
  children,
  ariaLabel = 'Pannello AI',
}: CardAIBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="card-ai-bottom-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={handleBackdropClick}
    >
      <div className="card-ai-bottom-sheet-content">
        {children}
      </div>
    </div>
  );
}
