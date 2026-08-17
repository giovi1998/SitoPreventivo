import { describe, it, expect } from 'vitest';
import { refreshPickedDetails } from '../pickedDetails';
import { createEmptyCard } from '../../schemas/card';
import type { PickedElement } from '../../../components/ElementPickerPanel';

describe('refreshPickedDetails', () => {
  it('aggiorna x/y/w/h con le coordinate correnti della grid', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { photo: { x: 0, y: 0, w: 2, h: 3 } },
    };
    const picked: PickedElement[] = [
      { label: 'photo', html: '<div/>', context: '', ref: 'front:photo', details: 'x:0 y:0 w:2 h:3' },
    ];
    // Simula un drag: photo spostata a x:1 y:2.
    card.grid.elements.photo = { x: 1, y: 2, w: 2, h: 3 };
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:1 y:2 w:2 h:3');
  });

  it('legge dal lato giusto (back:qr → backGrid)', () => {
    const card = createEmptyCard();
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: { qr: { x: 2, y: 0, w: 2, h: 4 } },
    };
    const picked: PickedElement[] = [
      { label: 'qr', html: '<div/>', context: '', ref: 'back:qr', details: 'x:2 y:0 w:2 h:4' },
    ];
    card.backGrid.elements.qr = { x: 0, y: 1, w: 2, h: 4 };
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:0 y:1 w:2 h:4');
  });

  it('lascia invariati elementi senza ref card (flyer/logo)', () => {
    const card = createEmptyCard();
    const picked: PickedElement[] = [
      { label: 'h2', html: '<h2/>', context: '', details: 'x:1' },
    ];
    expect(refreshPickedDetails(picked, card)).toEqual(picked);
  });

  it('mostra placement offset quando il drag lo modifica (live)', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { photo: { x: 0, y: 0, w: 2, h: 3, placement: { x: 0.5, y: -0.5, scale: 1 } } },
    };
    const picked: PickedElement[] = [
      { label: 'photo', html: '<div/>', context: '', ref: 'front:photo' },
    ];
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:0 y:0 w:2 h:3 · off 0.5,-0.5');
  });

  it('mostra placement scale quando zoom non neutro (live)', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { name: { x: 0, y: 0, w: 4, h: 1, placement: { x: 0, y: 0, scale: 1.25 } } },
    };
    const picked: PickedElement[] = [
      { label: 'name', html: '<div/>', context: '', ref: 'front:name' },
    ];
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:0 y:0 w:4 h:1 · zoom 1.25');
  });

  it('mostra offset e scale insieme quando entrambi non neutri', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { qr: { x: 2, y: 0, w: 2, h: 4, placement: { x: 0.3, y: 0.2, scale: 1.5 } } },
    };
    const picked: PickedElement[] = [
      { label: 'qr', html: '<div/>', context: '', ref: 'front:qr' },
    ];
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:2 y:0 w:2 h:4 · off 0.3,0.2 · zoom 1.5');
  });

  it('placement neutro (offset 0, scale 1) omette il suffix', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { photo: { x: 0, y: 0, w: 2, h: 3, placement: { x: 0, y: 0, scale: 1 } } },
    };
    const picked: PickedElement[] = [
      { label: 'photo', html: '<div/>', context: '', ref: 'front:photo' },
    ];
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:0 y:0 w:2 h:3');
  });

  it('legge photoPlacement (legacy alias) se placement assente', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { photo: { x: 0, y: 0, w: 2, h: 3, photoPlacement: { x: 0.4, y: 0, scale: 1 } } },
    };
    const picked: PickedElement[] = [
      { label: 'photo', html: '<div/>', context: '', ref: 'front:photo' },
    ];
    const next = refreshPickedDetails(picked, card);
    expect(next[0].details).toBe('x:0 y:0 w:2 h:3 · off 0.4,0');
  });
});