import React from 'react';

export interface CardExportMenuProps {
  variant: 'desktop' | 'mobile';
  open: boolean;
  exporting: 'pdf' | 'pdf-clean' | 'png-front' | 'png-back' | null;
  onToggle: () => void;
  onAction: (action: string) => void;
  menuRef?: React.RefObject<HTMLDivElement>;
}

const ACTIONS = [
  { action: 'pdf', label: 'PDF 10-up (tipografia, con segni di taglio)', busyLabel: 'Esportando…' },
  { action: 'pdf-clean', label: 'PDF 10-up (pulito, senza bordi/segni)', busyLabel: 'Esportando…' },
  { action: 'png-front', label: 'PNG fronte (300 DPI)', busyLabel: 'Esportando…' },
  { action: 'png-back', label: 'PNG retro (300 DPI)', busyLabel: 'Esportando…' },
  { action: 'svg-front', label: 'SVG fronte (vettoriale, editabile)', busyLabel: null },
  { action: 'svg-back', label: 'SVG retro (vettoriale, editabile)', busyLabel: null },
  { action: 'json', label: 'JSON (backup card data)', busyLabel: null },
];

export default function CardExportMenu({
  variant,
  open,
  exporting,
  onToggle,
  onAction,
  menuRef,
}: CardExportMenuProps) {
  const isMobile = variant === 'mobile';
  const buttonLabel = exporting
    ? (ACTIONS.find((a) => a.action === exporting)?.busyLabel ?? 'Esportando…')
    : 'Esporta ▾';

  if (isMobile) {
    return (
      <div className="card-mobile-export-wrap" ref={menuRef}>
        <button
          type="button"
          className="card-mobile-export-btn"
          data-testid="mobile-export-btn"
          onClick={onToggle}
          title="Esporta in vari formati"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>{buttonLabel}</span>
        </button>
        {open && (
          <ul className="card-mobile-export-menu" role="menu">
            {ACTIONS.map((a) => (
              <li key={a.action}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onAction(a.action)}
                >
                  {exporting === a.action && a.busyLabel ? a.busyLabel : a.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="card-export-menu" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {buttonLabel}
      </button>
      {open && (
        <ul className="card-export-list" role="menu">
          {ACTIONS.map((a) => (
            <li key={a.action}>
              <button
                type="button"
                role="menuitem"
                onClick={() => onAction(a.action)}
              >
                {exporting === a.action && a.busyLabel ? a.busyLabel : a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
