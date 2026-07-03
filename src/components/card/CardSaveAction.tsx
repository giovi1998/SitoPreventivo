import React from 'react';

export interface CardSaveActionProps {
  variant: 'desktop' | 'mobile';
  onClick: () => void;
  disabled?: boolean;
  isSaved?: boolean;
}

export default function CardSaveAction({ variant, onClick, disabled, isSaved }: CardSaveActionProps) {
  if (variant === 'mobile') {
    return (
      <button
        type="button"
        className="card-mobile-save-btn"
        data-testid="mobile-save-btn"
        onClick={onClick}
        disabled={disabled}
        title="Salva nel cloud"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{isSaved ? 'Salvato' : 'Salva'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card-action-primary"
      aria-label={isSaved ? 'Già salvato' : 'Salva'}
    >
      {isSaved ? 'Salvato' : 'Salva'}
    </button>
  );
}
