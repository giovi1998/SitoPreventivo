import { useCallback, useEffect, useRef, useState } from 'react';
import { enablePicker } from '../utils/website/elementPicker';
import './ElementPickerPanel.css';

export interface PickedElement {
  /** Etichetta breve (es. "h2", "grid-el-name", "svg text"). */
  label: string;
  /** HTML/XML dell'elemento (outerHTML). */
  html: string;
  /** Contesto testuale per il prompt AI (tag, attributi, testo, stile). */
  context: string;
  /** Riferimento per il refine mirato (es. key grid card). */
  ref?: string;
  /** Dettagli numerici (es. "x:2 y:0 w:2 h:1") mostrati nella lista. */
  details?: string;
}

export interface ElementPickerApi {
  /** Modalità picker attiva (hover highlight + click seleziona). */
  pickerMode: boolean;
  /** Attiva/disattiva la modalità. */
  toggle: () => void;
  /** Elementi selezionati. */
  selected: PickedElement[];
  /** Aggiunge un elemento (rispetta il max). */
  add: (el: Element) => void;
  /** Rimuove un elemento per indice. */
  remove: (index: number) => void;
  /** Svuota la selezione. */
  clear: () => void;
  /** Sostituisce la selezione (es. dettagli aggiornati). */
  sync: (next: PickedElement[]) => void;
  /** Re-estrae `html`/`label`/`context` dal DOM vivo per ogni elemento
   *  selezionato. Per editor che non hanno uno schema stato (flyer/logo):
   *  il testo cambia ma la lista resta stale finché non si re-seleziona. */
  refreshLive: (mapper: (el: Element, prev: PickedElement) => PickedElement) => void;
}

const PICKED_OUTLINE = '2px solid #16a34a';
const PICKED_OUTLINE_OFFSET = '1px';

/**
 * Hook picker elementi riusabile (card/flyer/logo/website): modalità
 * selezione con hover highlight, click seleziona, multi-selezione max 5,
 * Esc per uscire. Gli elementi selezionati restano evidenziati con outline
 * verde persistente (feedback visivo su cosa è stato selezionato).
 * `onPick` converte l'elemento DOM in PickedElement.
 */
export function useElementPicker(
  container: HTMLElement | Document | null,
  onPick: (el: Element) => PickedElement | null,
  max = 5,
): ElementPickerApi {
  const [pickerMode, setPickerMode] = useState(false);
  const [selected, setSelected] = useState<PickedElement[]>([]);
  const disableRef = useRef<(() => void) | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // Elementi DOM selezionati (per rimuovere l'outline al deselect).
  const pickedElsRef = useRef<HTMLElement[]>([]);

  const clearOutlines = useCallback(() => {
    for (const el of pickedElsRef.current) {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }
    pickedElsRef.current = [];
  }, []);

  const handlePick = useCallback((el: Element) => {
    const picked = onPickRef.current(el);
    if (!picked) return;
    setSelected((prev) => {
      if (prev.length >= max) return prev;
      // Outline verde persistente: l'utente vede cosa ha selezionato.
      const target = el as HTMLElement;
      target.style.outline = PICKED_OUTLINE;
      target.style.outlineOffset = PICKED_OUTLINE_OFFSET;
      pickedElsRef.current.push(target);
      return [...prev, picked];
    });
    // Esce dalla modalità picker dopo il click: la selezione è fatta.
    if (disableRef.current) {
      disableRef.current();
      disableRef.current = null;
    }
    setPickerMode(false);
  }, [max]);

  const toggle = useCallback(() => {
    if (!container) return;
    if (pickerMode) {
      if (disableRef.current) {
        disableRef.current();
        disableRef.current = null;
      }
      setPickerMode(false);
      return;
    }
    setPickerMode(true);
    disableRef.current = enablePicker(container, handlePick);
  }, [container, pickerMode, handlePick]);

  useEffect(() => {
    if (!pickerMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (disableRef.current) {
          disableRef.current();
          disableRef.current = null;
        }
        setPickerMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerMode]);

  useEffect(() => () => {
    if (disableRef.current) disableRef.current();
    clearOutlines();
  }, [clearOutlines]);

  const remove = useCallback((index: number) => {
    setSelected((prev) => {
      const el = pickedElsRef.current[index];
      if (el) {
        el.style.outline = '';
        el.style.outlineOffset = '';
        pickedElsRef.current.splice(index, 1);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clear = useCallback(() => {
    clearOutlines();
    setSelected([]);
  }, [clearOutlines]);

  const sync = useCallback((next: PickedElement[]) => {
    setSelected(next);
  }, []);

  const refreshLive = useCallback((mapper: (el: Element, prev: PickedElement) => PickedElement) => {
    setSelected((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((p, i) => {
        const el = pickedElsRef.current[i];
        if (!el) return p;
        const updated = mapper(el, p);
        if (updated.html !== p.html || updated.label !== p.label || updated.context !== p.context || updated.details !== p.details) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, []);

  return { pickerMode, toggle, selected, add: handlePick, remove, clear, sync, refreshLive };
}
