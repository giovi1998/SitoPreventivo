import type { BusinessCard } from '../schemas/card';
import type { GridRect } from '../gridUtils';
import type { PickedElement } from '../../components/ElementPickerPanel';

type Placement = { x: number; y: number; scale: number };

/**
 * Aggiorna i dettagli (x/y/w/h + placement) degli elementi selezionati con
 * le coordinate CORRENTI della grid. Il `ref` di un picked element card è
 * `"<side>:<gridKey>"` (es. "front:photo", "back:qr"): senza il lato non si
 * saprebbe da quale grid leggere.
 *
 * Il placement (offset x/y + scale) è ciò che il drag&drop modifica: senza
 * mostrarlo, le coordinate sembrano ferme durante il drag (perché la grid
 * x/y/w/h resta fissa — si muove solo l'offset dentro la cella).
 */
export function refreshPickedDetails(picked: PickedElement[], card: BusinessCard): PickedElement[] {
  return picked.map((p) => {
    if (!p.ref || !p.ref.includes(':')) return p;
    const [side, key] = p.ref.split(':');
    const grid = side === 'back' ? card.backGrid : card.grid;
    const el = (grid?.elements as Record<string, GridRect> | undefined)?.[key];
    if (!el) return p;
    const base = `x:${el.x} y:${el.y} w:${el.w} h:${el.h}`;
    const placement = (el as { placement?: Placement; photoPlacement?: Placement }).placement
      ?? (el as { photoPlacement?: Placement }).photoPlacement;
    const suffix = formatPlacement(placement);
    return { ...p, details: suffix ? `${base} · ${suffix}` : base };
  });
}

/** Render compatto del placement: omit se neutro (offset 0, scale 1). */
function formatPlacement(p: Placement | undefined): string {
  if (!p) return '';
  const hasOffset = p.x !== 0 || p.y !== 0;
  const hasScale = p.scale !== 1;
  if (!hasOffset && !hasScale) return '';
  const parts: string[] = [];
  if (hasOffset) parts.push(`off ${fmt(p.x)},${fmt(p.y)}`);
  if (hasScale) parts.push(`zoom ${fmt(p.scale)}`);
  return parts.join(' · ');
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}