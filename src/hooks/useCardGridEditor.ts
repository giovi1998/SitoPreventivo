import { useState, useCallback } from 'react';
import type { BusinessCard, BusinessCardLayout, CardGrid } from '../utils/documentSchemas';
import { gridPresetBackDefault, deriveGridFromLayout, hasGridElements } from '../utils/documentSchemas';
import type { GridSide } from '../components/card/CardGridControls';
import { pushLayoutEvent } from '../utils/card/layoutEvents';

interface UseCardGridEditorOptions {
  card: BusinessCard;
  setCard: React.Dispatch<React.SetStateAction<BusinessCard>>;
  addToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
}

export function useCardGridEditor({ card, setCard, addToast }: UseCardGridEditorOptions) {
  const [selectedFrontElement, setSelectedFrontElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [selectedBackElement, setSelectedBackElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [gridEditorSide, setGridEditorSide] = useState<GridSide>('front');
  const [showGrid, setShowGrid] = useState(false);

  const selectedGridElement = gridEditorSide === 'back' ? selectedBackElement : selectedFrontElement;

  const setGridEditorSideLogged = useCallback((s: GridSide) => {
    setGridEditorSide(s);
    pushLayoutEvent({ type: 'grid.side', side: s, result: 'ok' });
  }, []);

  const setSelectedGridElementLogged = useCallback((k: keyof CardGrid['elements'] | '') => {
    if (gridEditorSide === 'back') {
      setSelectedBackElement(k);
    } else {
      setSelectedFrontElement(k);
    }
    pushLayoutEvent({ type: 'grid.select', side: gridEditorSide, element: k || undefined, result: 'ok' });
  }, [gridEditorSide]);

  const patchGrid = useCallback((grid: CardGrid) => {
    setCard((prev) => {
      if (gridEditorSide === 'back') {
        return {
          ...prev,
          backGrid: grid,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...prev,
        grid,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [gridEditorSide, setCard]);

  const logGridChange = useCallback((type: 'move' | 'resize' | 'align', info: { element: string; applied: boolean; reason?: 'collision' | 'border'; payload?: Record<string, unknown> }) => {
    pushLayoutEvent({
      type: type === 'move' ? 'grid.move' : type === 'resize' ? 'grid.resize' : 'grid.align',
      side: gridEditorSide,
      element: info.element,
      result: info.applied ? 'ok' : info.reason === 'collision' || info.reason === 'border' ? 'blocked' : 'error',
      reason: info.reason,
      payload: info.payload,
    });
  }, [gridEditorSide]);

  const applyGridPreset = useCallback((preset: BusinessCardLayout) => {
    pushLayoutEvent({ type: 'grid.preset', side: gridEditorSide, result: 'ok', payload: { preset } });
    if (gridEditorSide === 'back') {
      setCard((prev) => ({
        ...prev,
        backGrid: gridPresetBackDefault(),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    const frontGrid = deriveGridFromLayout({ ...card, front: { ...card.front, layout: preset } }, 'front');
    setCard((prev) => ({
      ...prev,
      grid: frontGrid,
      updatedAt: new Date().toISOString(),
    }));
  }, [gridEditorSide, card, setCard]);

  const patchElementPlacement = useCallback((element: keyof CardGrid['elements'], patch: { x?: number; y?: number; scale?: number }) => {
    // Update FUNZIONALE: durante il drag (pointermove ~60Hz) più chiamate
    // nello stesso tick userebbero `card` stale dal closure → gli update
    // intermedi si sovrascrivono → il drag "non si aggiorna" (salta).
    setCard((prev) => {
      const targetGrid = gridEditorSide === 'back' ? (prev.backGrid ?? deriveGridFromLayout(prev, 'back')) : (prev.grid ?? deriveGridFromLayout(prev, 'front'));
      const el = targetGrid.elements[element];
      if (!el) return prev;
      const prevPlacement = el.placement ?? el.photoPlacement ?? { x: 0, y: 0, scale: 1 };
      const next: typeof prevPlacement = {
        x: patch.x ?? prevPlacement.x,
        y: patch.y ?? prevPlacement.y,
        scale: patch.scale ?? prevPlacement.scale,
      };
      const patched: CardGrid = { ...targetGrid, elements: { ...targetGrid.elements, [element]: { ...el, placement: next } } };
      return gridEditorSide === 'back'
        ? { ...prev, backGrid: patched, updatedAt: new Date().toISOString() }
        : { ...prev, grid: patched, updatedAt: new Date().toISOString() };
    });
  }, [gridEditorSide, setCard]);

  const handleAfterMove = useCallback((info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    logGridChange('move', { element: info.element, applied: info.applied, reason: info.reason, payload: { dx: info.dx, dy: info.dy } });
    if (info.applied) {
      const dir = (() => {
        if (info.dx > 0) return 'a destra';
        if (info.dx < 0) return 'a sinistra';
        if (info.dy > 0) return 'in basso';
        return 'in alto';
      })();
      addToast('success', `${info.element} spostato ${dir}`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: ${info.element} collide con un altro elemento`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast, logGridChange]);

  const handleAfterResize = useCallback((info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    logGridChange('resize', { element: info.element, applied: info.applied, reason: info.reason, payload: { dw: info.dw, dh: info.dh } });
    if (info.applied) {
      addToast('success', `${info.element} ridimensionato`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: resize causa collisione`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast, logGridChange]);

  const handleAfterAlign = useCallback((info: { element: string; alignH: 'left' | 'center' | 'right'; alignV: 'top' | 'center' | 'bottom' }) => {
    logGridChange('align', {
      element: info.element,
      applied: true,
      payload: { alignH: info.alignH, alignV: info.alignV },
    });
    addToast('success', `${info.element}: allineamento ${info.alignH}/${info.alignV}`, 2000);
  }, [addToast, logGridChange]);

  const handleToggleShowGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      pushLayoutEvent({ type: 'grid.toggle', side: gridEditorSide, result: 'ok', payload: { showGrid: next } });
      return next;
    });
    setCard((c) => {
      const next = !showGrid;
      if (!next) {
        addToast('info', 'Griglia disattivata', 2500);
        return { ...c, updatedAt: new Date().toISOString() };
      }
      let mutated = false;
      let nextCard: BusinessCard = c;
      const frontHasGrid = hasGridElements('front', c);
      const backHasGrid = hasGridElements('back', c);
      if (!c.grid || !frontHasGrid) {
        const initGrid = deriveGridFromLayout(c, 'front');
        nextCard = { ...nextCard, grid: initGrid };
        mutated = true;
      }
      if (!c.backGrid || !backHasGrid) {
        const initGrid = deriveGridFromLayout(c, 'back');
        nextCard = { ...nextCard, backGrid: initGrid };
        mutated = true;
      }
      if (mutated) {
        addToast('info', 'Griglia attiva, ora puoi spostare gli elementi', 3000);
      } else {
        addToast('info', 'Griglia attiva', 2500);
      }
      nextCard = {
        ...nextCard,
        front: { ...nextCard.front, useGrid: true },
        back: { ...nextCard.back, useGrid: true },
      };
      return { ...nextCard, updatedAt: new Date().toISOString() };
    });
  }, [addToast, showGrid, gridEditorSide, setCard]);

  const resetGridState = useCallback(() => {
    setShowGrid(false);
    setSelectedFrontElement('');
    setSelectedBackElement('');
    setGridEditorSide('front');
  }, []);

  return {
    selectedFrontElement,
    setSelectedFrontElement,
    selectedBackElement,
    setSelectedBackElement,
    gridEditorSide,
    setGridEditorSide,
    showGrid,
    setShowGrid,
    selectedGridElement,
    setGridEditorSideLogged,
    setSelectedGridElementLogged,
    patchGrid,
    applyGridPreset,
    patchElementPlacement,
    handleAfterMove,
    handleAfterResize,
    handleAfterAlign,
    handleToggleShowGrid,
    resetGridState,
  };
}
