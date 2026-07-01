import React, { useEffect, useMemo, useState } from 'react';
import type { BusinessCard, CardGrid } from '../../utils/documentSchemas';
import { hasGridElements, deriveGridFromLayout } from '../../utils/documentSchemas';
import {
  canMove as canMoveUtil,
  canResize as canResizeUtil,
  wouldCollideOnMove,
  wouldCollideOnResize,
} from '../../utils/gridUtils';

export type GridSide = 'front' | 'back';

export interface CardGridControlsProps {
  card: BusinessCard;
  side: GridSide;
  /** Master switch (REQ-E01): quando false, i controlli sono disabilitati. */
  gridEnabled: boolean;
  onSideChange: (s: GridSide) => void;
  onChangeGrid: (grid: CardGrid, persist: { useGrid: boolean }) => void;
  /** Elemento selezionato (controllato dal parent per persistenza cross-tab). */
  selected: keyof CardGrid['elements'] | '';
  onSelect: (k: keyof CardGrid['elements'] | '') => void;
  /** Phase 2.2: applica un preset di griglia (callback opzionale). */
  onApplyPreset?: (p: 'left' | 'centered' | 'split') => void;
  /** Restituisce informazioni sulla mossa applicata (per toast feedback in G). */
  onAfterMove?: (info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  onAfterResize?: (info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  /**
   * Modalità presentazione:
   *  - 'inline' (default desktop): mostra frecce + ridimensiona inline
   *  - 'mobile': nasconde le frecce/resize inline; il parent gestisce la
   *    popup separatamente (vedi MobileGridEditor).
   */
  mode?: 'inline' | 'mobile';
}

// Elementi del FRONTE/RETRO per la select. Filtrati da `availableElements`
// (passato dal parent) in base al contenuto (vedi spec REQ-B02).
const FRONT_KEYS: Array<{ value: keyof CardGrid['elements']; label: string }> = [
  { value: 'photo', label: 'Foto' },
  { value: 'name', label: 'Nome' },
  { value: 'title', label: 'Ruolo' },
  { value: 'company', label: 'Azienda' },
  { value: 'logo', label: 'Logo' },
];

const BACK_KEYS: Array<{ value: keyof CardGrid['elements']; label: string }> = [
  { value: 'contacts', label: 'Contatti' },
  { value: 'qr', label: 'QR' },
  { value: 'socials', label: 'Social' },
];

export function getAvailableGridElements(side: GridSide, card: BusinessCard): Array<{ value: keyof CardGrid['elements']; label: string }> {
  if (side === 'front') {
    const els: Array<{ value: keyof CardGrid['elements']; label: string }> = [];
    if (card.front.photoUrl) els.push(FRONT_KEYS.find((k) => k.value === 'photo')!);
    if (card.front.logoUrl) els.push(FRONT_KEYS.find((k) => k.value === 'logo')!);
    if (card.front.name.trim()) els.push(FRONT_KEYS.find((k) => k.value === 'name')!);
    if (card.front.title.trim()) els.push(FRONT_KEYS.find((k) => k.value === 'title')!);
    if (card.front.company.trim()) els.push(FRONT_KEYS.find((k) => k.value === 'company')!);
    return els;
  }
  const els: Array<{ value: keyof CardGrid['elements']; label: string }> = [];
  const hasContacts = card.back.phone.trim() || card.back.email.trim() ||
    card.back.website.trim() || card.back.address.trim() || card.back.vatNumber.trim();
  if (hasContacts) els.push(BACK_KEYS.find((k) => k.value === 'contacts')!);
  if (card.back.qrPayload.trim() || card.back.website.trim()) {
    els.push(BACK_KEYS.find((k) => k.value === 'qr')!);
  }
  if (card.back.socials.some((s) => s.platform && s.url)) {
    els.push(BACK_KEYS.find((k) => k.value === 'socials')!);
  }
  return els;
}

// Phase 2.2 REQ-B02: controlli grid condivisi desktop/mobile. Render inline
// (usato in desktop), il wrapping con popup è responsabilità di MobileGridEditor.
export function CardGridControls({
  card,
  side,
  gridEnabled,
  onSideChange,
  onChangeGrid,
  onApplyPreset,
  selected,
  onSelect,
  onAfterMove,
  onAfterResize,
  mode = 'inline',
}: CardGridControlsProps) {
  const activeGrid: CardGrid = useMemo(() => {
    if (side === 'back') {
      return card.backGrid ?? deriveGridFromLayout(card, 'back');
    }
    return card.grid ?? deriveGridFromLayout(card, 'front');
  }, [side, card]);

  const availableElements = useMemo(() => getAvailableGridElements(side, card), [side, card]);
  const selectedEl = selected ? activeGrid.elements[selected] : undefined;

  // Fix: il preset selezionato deve restare visibile nel dropdown (prima
  // si resettava subito a ", seleziona preset:"). Stato locale persistente,
  // resettato quando cambia il lato (i preset differiscono fronte/retro).
  const [presetChoice, setPresetChoice] = useState<string>('');
  useEffect(() => { setPresetChoice(''); }, [side]);

  const canMoveLeft  = !!selectedEl && selectedEl.x > 0
    && !wouldCollideOnMove(activeGrid, selected, -1, 0);
  const canMoveUp    = !!selectedEl && selectedEl.y > 0
    && !wouldCollideOnMove(activeGrid, selected, 0, -1);
  const canMoveRight = !!selectedEl && selectedEl.x + selectedEl.w < activeGrid.cols
    && !wouldCollideOnMove(activeGrid, selected, 1, 0);
  const canMoveDown  = !!selectedEl && selectedEl.y + selectedEl.h < activeGrid.rows
    && !wouldCollideOnMove(activeGrid, selected, 0, 1);
  const canShrinkW = !!selectedEl && selectedEl.w > 1;
  const canGrowW   = !!selectedEl && selectedEl.x + selectedEl.w < activeGrid.cols
    && !wouldCollideOnResize(activeGrid, selected, 1, 0);
  const canShrinkH = !!selectedEl && selectedEl.h > 1;
  const canGrowH   = !!selectedEl && selectedEl.y + selectedEl.h < activeGrid.rows
    && !wouldCollideOnResize(activeGrid, selected, 0, 1);

  const isSideDisabled = !gridEnabled;
  const disabledTitle = gridEnabled ? '' : 'Griglia OFF, attivala per spostare elementi';

  const handleMove = (dx: number, dy: number) => {
    if (!selected) return;
    const el = activeGrid.elements[selected];
    if (!el) return;
    const x = el.x + dx, y = el.y + dy;
    if (x < 0 || y < 0 || x + el.w > activeGrid.cols || y + el.h > activeGrid.rows) {
      onAfterMove?.({ element: selected, dx, dy, applied: false, reason: 'border' });
      return;
    }
    if (wouldCollideOnMove(activeGrid, selected, dx, dy)) {
      onAfterMove?.({ element: selected, dx, dy, applied: false, reason: 'collision' });
      return;
    }
    onChangeGrid(
      { ...activeGrid, elements: { ...activeGrid.elements, [selected]: { ...el, x, y } } },
      { useGrid: true },
    );
    onAfterMove?.({ element: selected, dx, dy, applied: true });
  };

  const handleResize = (dw: number, dh: number) => {
    if (!selected) return;
    const el = activeGrid.elements[selected];
    if (!el) return;
    const nw = el.w + dw, nh = el.h + dh;
    if (nw < 1 || nh < 1 || el.x + nw > activeGrid.cols || el.y + nh > activeGrid.rows) {
      onAfterResize?.({ element: selected, dw, dh, applied: false, reason: 'border' });
      return;
    }
    if (wouldCollideOnResize(activeGrid, selected, dw, dh)) {
      onAfterResize?.({ element: selected, dw, dh, applied: false, reason: 'collision' });
      return;
    }
    onChangeGrid(
      { ...activeGrid, elements: { ...activeGrid.elements, [selected]: { ...el, w: nw, h: nh } } },
      { useGrid: true },
    );
    onAfterResize?.({ element: selected, dw, dh, applied: true });
  };

  const handleSetGridSize = (cols: number, rows: number) => {
    if (cols < 2 || cols > 8 || rows < 2 || rows > 8) return;
    onChangeGrid({ ...activeGrid, cols, rows }, { useGrid: true });
  };

  const elementOptions = side === 'front' ? FRONT_KEYS : BACK_KEYS;

  return (
    <div
      className="card-grid-editor"
      data-testid="card-grid-editor"
      data-disabled={isSideDisabled || undefined}
    >
      <div className="card-grid-editor-title">Sposta elementi sulla griglia</div>
      {isSideDisabled && (
        <p className="card-grid-editor-hint" data-testid="grid-editor-disabled-hint">
          Attiva <strong>“Griglia ON”</strong> in alto a destra per spostare e ridimensionare gli elementi.
        </p>
      )}
      <label className="card-field">
        <span>Lato</span>
        <select
          value={side}
          onChange={(e) => {
            const s = e.target.value as GridSide;
            onSideChange(s);
          }}
          disabled={isSideDisabled}
          aria-label="Lato griglia"
          data-testid="grid-editor-side"
        >
          <option value="front">Fronte</option>
          <option value="back">Retro</option>
        </select>
      </label>
      <label className="card-field">
        <span>Preset griglia</span>
        <select
          value={presetChoice}
          disabled={isSideDisabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') { setPresetChoice(''); return; }
            // Persisti la scelta nel dropdown (resta visibile)
            setPresetChoice(v);
            // Delego SEMPRE al parent: il parent conosce `applyGridPreset`
            // che SOSTITUISCE completamente la grid (no merge → no duplicati
            // di elementi come `logo` che cambiavano solo posizione).
            if (typeof onApplyPreset === 'function') {
              onApplyPreset(v as 'left' | 'centered' | 'split');
              return;
            }
            // Fallback solo se il parent non passa onApplyPreset (es. test).
            const FRONT_PRESETS: Record<string, CardGrid> = {
              left: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 1, h: 4 }, name: { x: 1, y: 0, w: 3, h: 1 }, title: { x: 1, y: 1, w: 3, h: 1 }, company: { x: 1, y: 2, w: 2, h: 1 }, logo: { x: 3, y: 2, w: 1, h: 2 } } },
              centered: { cols: 4, rows: 4, elements: { photo: { x: 1, y: 0, w: 2, h: 1 }, name: { x: 0, y: 1, w: 4, h: 1 }, title: { x: 0, y: 2, w: 4, h: 1 }, company: { x: 0, y: 3, w: 3, h: 1 }, logo: { x: 3, y: 3, w: 1, h: 1 } } },
              split: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 2, h: 4 }, name: { x: 2, y: 0, w: 2, h: 1 }, title: { x: 2, y: 1, w: 2, h: 1 }, company: { x: 2, y: 2, w: 2, h: 1 }, logo: { x: 2, y: 3, w: 2, h: 1 } } },
            };
            const grid = side === 'back'
              ? { cols: 4, rows: 4, elements: { contacts: { x: 0, y: 0, w: 3, h: 4 }, qr: { x: 3, y: 0, w: 1, h: 2 }, socials: { x: 3, y: 2, w: 1, h: 2 } } }
              : FRONT_PRESETS[v] || FRONT_PRESETS.split;
            onChangeGrid(grid, { useGrid: true });
          }}
          aria-label="Preset griglia"
          data-testid="grid-editor-preset"
        >
          <option value="">, seleziona preset:</option>
          {side === 'front' ? (
            <>
              <option value="left">Sinistra (foto a sx)</option>
              <option value="centered">Centrato</option>
              <option value="split">Diviso (testo + logo)</option>
            </>
          ) : (
            <option value="split">Default retro (contatti + QR)</option>
          )}
        </select>
      </label>
      <label className="card-field">
        <span>Elemento selezionato</span>
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value as keyof CardGrid['elements'] | '')}
          // FIX: il selettore deve essere abilitato quando la griglia è ON,
          // anche se nessun elemento è ancora selezionato (altrimenti è
          // impossibile selezionare il primo, chicken-and-egg).
          disabled={isSideDisabled}
          aria-label="Elemento selezionato"
        >
          <option value="">:</option>
          {availableElements.map((el) => (
            <option key={el.value} value={el.value}>{el.label}</option>
          ))}
          {availableElements.length === 0 && (
            <option value="" disabled>Nessun elemento con contenuto</option>
          )}
          {availableElements.length > 0 && elementOptions
            .filter((opt) => !availableElements.find((a) => a.value === opt.value))
            .map((opt) => (
              <option key={opt.value} value={opt.value} disabled>{opt.label} (senza contenuto)</option>
            ))}
        </select>
      </label>
      <div className="card-row-2">
        <label className="card-field">
          <span>Colonne ({activeGrid.cols})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => handleSetGridSize(Math.max(2, activeGrid.cols - 1), activeGrid.rows)}
              disabled={isSideDisabled || activeGrid.cols <= 2}
              aria-label="Diminuisci colonne"
              className="card-preview-zoom-btn"
            >−</button>
            <button
              type="button"
              onClick={() => handleSetGridSize(Math.min(8, activeGrid.cols + 1), activeGrid.rows)}
              disabled={isSideDisabled || activeGrid.cols >= 8}
              aria-label="Aumenta colonne"
              className="card-preview-zoom-btn"
            >+</button>
          </div>
        </label>
        <label className="card-field">
          <span>Righe ({activeGrid.rows})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => handleSetGridSize(activeGrid.cols, Math.max(2, activeGrid.rows - 1))}
              disabled={isSideDisabled || activeGrid.rows <= 2}
              aria-label="Diminuisci righe"
              className="card-preview-zoom-btn"
            >−</button>
            <button
              type="button"
              onClick={() => handleSetGridSize(activeGrid.cols, Math.min(8, activeGrid.rows + 1))}
              disabled={isSideDisabled || activeGrid.rows >= 8}
              aria-label="Aumenta righe"
              className="card-preview-zoom-btn"
            >+</button>
          </div>
        </label>
      </div>
      {mode === 'inline' && (
        <>
          <div className="card-grid-arrows" role="group" aria-label="Sposta elemento">
            <button
              type="button"
              onClick={() => handleMove(-1, 0)}
              disabled={!gridEnabled || !canMoveLeft}
              aria-label="Sposta a sinistra"
              title={!canMoveLeft ? (selectedEl?.x === 0 ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta a sinistra'}
              data-testid="grid-move-left"
            ><span aria-hidden="true">←</span></button>
            <button
              type="button"
              onClick={() => handleMove(0, -1)}
              disabled={!gridEnabled || !canMoveUp}
              aria-label="Sposta su"
              title={!canMoveUp ? (selectedEl?.y === 0 ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta su'}
            ><span aria-hidden="true">↑</span></button>
            <button
              type="button"
              onClick={() => handleMove(0, 1)}
              disabled={!gridEnabled || !canMoveDown}
              aria-label="Sposta giù"
              title={!canMoveDown ? ((selectedEl?.y ?? 0) + (selectedEl?.h ?? 0) >= activeGrid.rows ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta giù'}
            ><span aria-hidden="true">↓</span></button>
            <button
              type="button"
              onClick={() => handleMove(1, 0)}
              disabled={!gridEnabled || !canMoveRight}
              aria-label="Sposta a destra"
              title={!canMoveRight ? ((selectedEl?.x ?? 0) + (selectedEl?.w ?? 0) >= activeGrid.cols ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta a destra'}
              data-testid="grid-move-right"
            ><span aria-hidden="true">→</span></button>
          </div>
          <div className="card-grid-resize" role="group" aria-label="Ridimensiona elemento">
            <button
              type="button"
              onClick={() => handleResize(-1, 0)}
              disabled={!gridEnabled || !canShrinkW}
              aria-label="Riduci larghezza"
              title={!canShrinkW ? 'Larghezza minima 1' : disabledTitle || 'Riduci larghezza'}
            ><span aria-hidden="true">−↔</span></button>
            <button
              type="button"
              onClick={() => handleResize(1, 0)}
              disabled={!gridEnabled || !canGrowW}
              aria-label="Aumenta larghezza"
              title={!canGrowW ? (selectedEl && selectedEl.x + selectedEl.w >= activeGrid.cols ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Aumenta larghezza'}
            ><span aria-hidden="true">+↔</span></button>
            <button
              type="button"
              onClick={() => handleResize(0, -1)}
              disabled={!gridEnabled || !canShrinkH}
              aria-label="Riduci altezza"
              title={!canShrinkH ? 'Altezza minima 1' : disabledTitle || 'Riduci altezza'}
            ><span aria-hidden="true">−↕</span></button>
            <button
              type="button"
              onClick={() => handleResize(0, 1)}
              disabled={!gridEnabled || !canGrowH}
              aria-label="Aumenta altezza"
              title={!canGrowH ? (selectedEl && selectedEl.y + selectedEl.h >= activeGrid.rows ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Aumenta altezza'}
            ><span aria-hidden="true">+↕</span></button>
          </div>
        </>
      )}
    </div>
  );
}
