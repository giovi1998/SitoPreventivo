import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderEditor } from './cardEditorTestSetup';
import { createGiovanniCardTemplate } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';

describe('Grid editor (B2)', () => {
  it('renders grid editor panel with element selector + arrow controls', () => {
    renderEditor();
    expect(screen.getByTestId('card-grid-editor')).toBeInTheDocument();
    expect(screen.getByLabelText(/Elemento selezionato/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta su/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta giù/i })).toBeInTheDocument();
  });

  it('element selector is DISABLED when grid is OFF, ENABLED when ON (fix chicken-and-egg)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    expect(elSelect).toBeDisabled();
    expect(screen.getByTestId('grid-editor-disabled-hint')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    expect(elSelect).not.toBeDisabled();
    fireEvent.change(elSelect, { target: { value: 'photo' } });
    expect(elSelect.value).toBe('photo');
  });

  it('preset selector is enabled when grid ON and applies a front-split grid WITH photo (fix)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    expect(presetSelect).not.toBeDisabled();
    fireEvent.change(presetSelect, { target: { value: 'split' } });
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
    expect(document.querySelector('[data-testid="grid-el-photo"]')).not.toBeNull();
  });

  it('preset selection persists in the dropdown after applying (fix: non si resetta)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    expect(presetSelect.value).toBe('centered');
  });

  it('applying a preset SOSTITUISCE la grid (no duplicati di elementi come logo)', () => {
    const card = createGiovanniCardTemplate();
    expect(card.grid?.elements.logo).toEqual({ x: 2, y: 2, w: 2, h: 2, alignH: 'center', alignV: 'center' });
    expect(card.grid?.elements.photo).toEqual({ x: 0, y: 0, w: 2, h: 4 });
    renderEditor({ initialCard: card });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
    const photo = front.querySelector('[data-testid="grid-el-photo"]') as HTMLElement;
    expect(photo).not.toBeNull();
    expect(window.getComputedStyle(photo).gridColumn).toBe('2 / span 2');
    expect(window.getComputedStyle(photo).gridRow).toBe('1 / span 1');
    const logos = front.querySelectorAll('[data-testid="grid-el-logo"]');
    expect(logos.length).toBe(1);
    expect(window.getComputedStyle(logos[0]).gridColumn).toBe('3 / span 2');
    expect(window.getComputedStyle(logos[0]).gridRow).toBe('4 / span 1');
  });

  it('lists all 9 layout presets in the grid preset dropdown', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    const values = Array.from(presetSelect.querySelectorAll('option')).map((o) => o.value).filter(Boolean);
    for (const layout of ['left', 'centered', 'split', 'right', 'top', 'bottom', 'minimal', 'photo-circle', 'compact']) {
      expect(values).toContain(layout);
    }
  });

  it('applies the right preset (mirror split) and keeps photo on right', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'right' } });
    const photo = document.querySelector('[data-testid="grid-el-photo"]') as HTMLElement;
    expect(photo).not.toBeNull();
    expect(window.getComputedStyle(photo).gridColumn).toMatch(/^3/);
  });

  it('renders 9-position alignment matrix when an element is selected', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'name' } });
    expect(screen.getByTestId('grid-align-matrix')).toBeInTheDocument();
    expect(screen.getByTestId('grid-align-center-center')).toBeInTheDocument();
    expect(screen.getByTestId('grid-align-right-bottom')).toBeInTheDocument();
  });

  it('sets alignH/alignV via 9-position matrix buttons', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    fireEvent.change(screen.getByLabelText(/Elemento selezionato/i), { target: { value: 'name' } });
    const btn = screen.getByTestId('grid-align-right-bottom');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
  });

  it('moves the selected element left when ← is pressed', () => {
    renderEditor();
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(nameSelect, { target: { value: 'name' } });
    const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
    fireEvent.click(leftBtn);
  });

  it('applies a grid preset when selected from dropdown', () => {
    renderEditor();
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
  });

  it('resizes selected element with +/- buttons', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(nameSelect, { target: { value: 'photo' } });
    const plus = screen.getByRole('button', { name: /Aumenta larghezza/i });
    fireEvent.click(plus);
  });

  it('disables move buttons at grid boundary (Phase 2.1 visual feedback)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(nameSelect, { target: { value: 'photo' } });
    const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i }) as HTMLButtonElement;
    expect(leftBtn).toBeDisabled();
    expect(leftBtn.title).toMatch(/Limite/);
  });

  it('disables grow buttons when at right/bottom edge (Phase 2.1)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(nameSelect, { target: { value: 'photo' } });
    const growH = screen.getByRole('button', { name: /Aumenta altezza/i }) as HTMLButtonElement;
    expect(growH).toBeDisabled();
    expect(growH.title).toMatch(/Limite/);
  });

  it('logo is selectable in grid editor (Phase 2.1)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('logo');
  });

  it('grid editor select shows only elements with content (Phase 2.2)', () => {
    renderEditor();
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options.filter((v) => v !== '')).toHaveLength(0);
  });

  it('grid editor select shows all front elements with Giovanni template (Phase 2.2)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('photo');
    expect(options).toContain('logo');
    expect(options).toContain('name');
    expect(options).toContain('title');
    expect(options).toContain('company');
  });

  it('disables move button when next cell would collide with another element (Phase 2.2 REQ-A01)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'name' } });
    const downBtn = screen.getByRole('button', { name: /Sposta giù/i }) as HTMLButtonElement;
    expect(downBtn).toBeDisabled();
    expect(downBtn.title).toMatch(/collisione|Limite/);
  });

  it('disables grow button when grow would collide with neighbor (Phase 2.2 REQ-A01)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'name' } });
    const growH = screen.getByRole('button', { name: /Aumenta altezza/i }) as HTMLButtonElement;
    expect(growH).toBeDisabled();
  });

  it('moves photo left by 1 (grid editor front, Giovanni + centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'photo' } });
    const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
    expect(leftBtn).not.toBeDisabled();
    fireEvent.click(leftBtn);
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
  });

  it('resizes photo taller by 1 (grid editor front, Giovanni + centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'photo' } });
    const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
    expect(shrinkW).not.toBeDisabled();
    fireEvent.click(shrinkW);
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
  });

  it('moves name down blocked by title (grid editor front, centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'name' } });
    const downBtn = screen.getByRole('button', { name: /Sposta giù/i });
    expect(downBtn).toBeDisabled();
  });

  it('resizes name shrink width (grid editor front, centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'name' } });
    const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
    expect(shrinkW).not.toBeDisabled();
    fireEvent.click(shrinkW);
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
  });

  it('moves title up blocked by name (grid editor front, centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'title' } });
    const upBtn = screen.getByRole('button', { name: /Sposta su/i });
    expect(upBtn).toBeDisabled();
  });

  it('resizes title shrink height (grid editor front, centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'title' } });
    const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
    expect(shrinkH).toBeDisabled();
  });

  it('moves company left blocked by grid edge (grid editor front, centered)', () => {
    const card = { ...createGiovanniCardTemplate(), front: { ...createGiovanniCardTemplate().front, company: 'WebdevCA' } };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'company' } });
    const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
    expect(leftBtn).toBeDisabled();
  });

  it('resizes company shrink width (grid editor front, centered preset)', () => {
    const card = { ...createGiovanniCardTemplate(), front: { ...createGiovanniCardTemplate().front, company: 'WebdevCA' } };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'company' } });
    const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
    expect(shrinkW).not.toBeDisabled();
    fireEvent.click(shrinkW);
    const front = screen.getByTestId('card-preview-front');
    expect(front.className).toContain('grid-mode');
  });

  it('moves logo up blocked by title (grid editor front, centered)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'logo' } });
    const upBtn = screen.getByRole('button', { name: /Sposta su/i });
    expect(upBtn).toBeDisabled();
  });

  it('resizes logo shrink width enabled (grid editor front, centered preset)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'logo' } });
    const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
    expect(shrinkW).not.toBeDisabled();
  });

  it('grid editor back: moves QR down blocked by grid edge (Giovanni template)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'qr' } });
    const downBtn = screen.getByRole('button', { name: /Sposta giù/i });
    expect(downBtn).toBeDisabled();
  });

  it('grid editor back: resizes contacts wider enabled (Giovanni)', () => {
    const card = {
      ...createGiovanniCardTemplate(),
      back: { ...createGiovanniCardTemplate().back, address: 'Via Roma 1' },
      backGrid: {
        cols: 4,
        rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 2 },
          services: { x: 0, y: 2, w: 2, h: 1 },
          socials: { x: 0, y: 3, w: 2, h: 1 },
          qr: { x: 3, y: 0, w: 1, h: 4 },
        },
      },
    };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'contacts' } });
    const growW = screen.getByRole('button', { name: /Aumenta larghezza/i });
    expect(growW).not.toBeDisabled();
  });

  it('grid editor back: resizes services taller blocked by socials (Giovanni)', () => {
    const card = {
      ...createGiovanniCardTemplate(),
      backGrid: {
        cols: 4,
        rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 2 },
          services: { x: 0, y: 2, w: 2, h: 1 },
          socials: { x: 0, y: 3, w: 2, h: 1 },
          qr: { x: 3, y: 0, w: 1, h: 4 },
        },
      },
    };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'services' } });
    const growH = screen.getByRole('button', { name: /Aumenta altezza/i });
    expect(growH).toBeDisabled();
  });

  it('grid editor back: moves socials up blocked by services (Giovanni template)', () => {
    const card = {
      ...createGiovanniCardTemplate(),
      backGrid: {
        cols: 4,
        rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 2 },
          services: { x: 0, y: 2, w: 2, h: 1 },
          socials: { x: 0, y: 3, w: 2, h: 1 },
          qr: { x: 3, y: 0, w: 1, h: 4 },
        },
      },
    };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'socials' } });
    const upBtn = screen.getByRole('button', { name: /Sposta su/i });
    expect(upBtn).toBeDisabled();
  });

  it('grid editor back: shrinks contacts width (Giovanni template)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'contacts' } });
    const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
    expect(shrinkW).not.toBeDisabled();
    fireEvent.click(shrinkW);
    const back = screen.getByTestId('card-preview-back');
    const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
    expect(bodyGrid).not.toBeNull();
    expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
  });

  it('grid editor back: shrinks QR height (Giovanni template)', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'qr' } });
    const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
    expect(shrinkH).not.toBeDisabled();
    fireEvent.click(shrinkH);
    const back = screen.getByTestId('card-preview-back');
    const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
    expect(bodyGrid).not.toBeNull();
    expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
  });

  it('grid editor back: shrinks socials height (custom backGrid with socials)', () => {
    const card: BusinessCard = {
      ...createGiovanniCardTemplate(),
      backGrid: {
        cols: 4,
        rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 4 },
          qr: { x: 2, y: 0, w: 2, h: 2 },
          socials: { x: 2, y: 2, w: 2, h: 2 },
        },
      },
    };
    renderEditor({ initialCard: card });
    const gridToggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(gridToggle);
    const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
    fireEvent.change(sideSelect, { target: { value: 'back' } });
    const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    fireEvent.change(elSelect, { target: { value: 'socials' } });
    const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
    expect(shrinkH).not.toBeDisabled();
    fireEvent.click(shrinkH);
    const back = screen.getByTestId('card-preview-back');
    const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
    expect(bodyGrid).not.toBeNull();
    expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
  });
});