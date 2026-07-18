import React, { useEffect, useRef, useState } from 'react';
import './ActionBar.css';

export interface ActionBarExportItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface ActionBarProps {
  /** Salva (primary). Se omesso, il bottone non appare. */
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  /** Nuovo (ghost). Se omesso, il bottone non appare. */
  onNew?: () => void;
  newDisabled?: boolean;
  newLabel?: string;
  /** Voci del menu Esporta (secondary). Se vuoto/omesso, niente menu. */
  exportItems?: ActionBarExportItem[];
  onExport?: (id: string) => void;
  exportDisabled?: boolean;
  /** Contenuti extra a sinistra del cluster (es. hint). */
  children?: React.ReactNode;
}

/**
 * Primary Action Bar uniforme (Phase 13b, REQ-UX-004/005).
 * Cluster fisso bottom-right su desktop, sticky-bottom su mobile
 * (safe-area). Gerarchia: Salva primary, Esporta secondary con menu,
 * Nuovo ghost.
 */
export default function ActionBar({
  onSave,
  saveDisabled = false,
  saveLabel = 'Salva',
  onNew,
  newDisabled = false,
  newLabel = 'Nuovo',
  exportItems = [],
  onExport,
  exportDisabled = false,
  children,
}: ActionBarProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleExport = (id: string) => {
    setMenuOpen(false);
    onExport?.(id);
  };

  return (
    <div className="action-bar" role="toolbar" aria-label="Azioni documento">
      {children && <div className="action-bar__extra">{children}</div>}
      <div className="action-bar__cluster">
        {onNew && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--ghost"
            onClick={onNew}
            disabled={newDisabled}
          >
            {newLabel}
          </button>
        )}
        {exportItems.length > 0 && (
          <div className="action-bar__export" ref={menuRef}>
            <button
              type="button"
              className="action-bar__btn action-bar__btn--secondary"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={exportDisabled}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              Esporta ▾
            </button>
            {menuOpen && (
              <div className="action-bar__menu" role="menu">
                {exportItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="action-bar__menu-item"
                    onClick={() => handleExport(item.id)}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onSave && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--primary"
            onClick={onSave}
            disabled={saveDisabled}
          >
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
