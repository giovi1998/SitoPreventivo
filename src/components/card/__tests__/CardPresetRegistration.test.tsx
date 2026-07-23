import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CardGridControls } from '../CardGridControls';
import { LAYOUT_LABELS } from '../labels';
import {
  businessCardLayoutSchema,
  FRONT_GRID_PRESETS,
  gridPresetRightBalanced,
  createEmptyCard,
} from '../../../utils/documentSchemas';
import type { BusinessCardLayout } from '../../../utils/documentSchemas';
import { collides } from '../../../utils/gridUtils';

// REQ-TEST-004: invariante di registrazione preset. Ogni layout dello schema
// deve avere (1) una factory in FRONT_GRID_PRESETS, (2) una label in
// LAYOUT_LABELS, (3) un'opzione nel selettore preset di CardGridControls
// (fronte). Senza questo invariante un nuovo layout nello schema può
// restare non selezionabile o non derivabile in griglia.
const LAYOUTS = businessCardLayoutSchema.options as BusinessCardLayout[];

describe('preset registration invariant (REQ-TEST-004)', () => {
  it('every businessCardLayoutSchema value has a factory in FRONT_GRID_PRESETS', () => {
    for (const layout of LAYOUTS) {
      const factory = FRONT_GRID_PRESETS[layout];
      expect(typeof factory, `missing FRONT_GRID_PRESETS factory for "${layout}"`).toBe('function');
      const grid = factory();
      expect(grid.cols).toBeGreaterThanOrEqual(2);
      expect(grid.rows).toBeGreaterThanOrEqual(2);
    }
    // Nessuna factory orfana (layout rimosso dallo schema ma non dalla mappa).
    expect(Object.keys(FRONT_GRID_PRESETS).sort()).toEqual([...LAYOUTS].sort());
  });

  it('every businessCardLayoutSchema value has a label in LAYOUT_LABELS', () => {
    for (const layout of LAYOUTS) {
      expect(LAYOUT_LABELS[layout], `missing LAYOUT_LABELS entry for "${layout}"`).toBeTruthy();
    }
    expect(Object.keys(LAYOUT_LABELS).sort()).toEqual([...LAYOUTS].sort());
  });

  it('every businessCardLayoutSchema value is an option in the front preset selector', () => {
    render(
      <CardGridControls
        card={createEmptyCard()}
        side="front"
        gridEnabled
        onSideChange={vi.fn()}
        onChangeGrid={vi.fn()}
        selected=""
        onSelect={vi.fn()}
        onPatchPlacement={vi.fn()}
      />,
    );
    const select = screen.getByTestId('grid-editor-preset');
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    for (const layout of LAYOUTS) {
      expect(values, `missing preset selector option for "${layout}"`).toContain(layout);
    }
  });

  it('gridPresetRightBalanced cell map has no collisions and stays in bounds', () => {
    const grid = gridPresetRightBalanced();
    const entries = Object.entries(grid.elements).filter(
      (e): e is [string, { x: number; y: number; w: number; h: number }] => !!e[1],
    );
    for (const [key, rect] of entries) {
      expect(rect.x, key).toBeGreaterThanOrEqual(0);
      expect(rect.y, key).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w, key).toBeLessThanOrEqual(grid.cols);
      expect(rect.y + rect.h, key).toBeLessThanOrEqual(grid.rows);
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        expect(
          collides(entries[i][1], entries[j][1]),
          `"${entries[i][0]}" collides with "${entries[j][0]}"`,
        ).toBe(false);
      }
    }
  });
});
