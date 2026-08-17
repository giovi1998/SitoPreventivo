import { describe, it, expect } from 'vitest';
import { analyzeCard } from '../cardAnalyzer';
import { createEmptyCard } from '../../schemas/card';

describe('analyzeCard', () => {
  it('segnala campi vuoti', () => {
    const card = createEmptyCard();
    const res = analyzeCard(card);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('Nome è vuoto'))).toBe(true);
  });

  it('segnala collisioni grid', () => {
    const card = createEmptyCard();
    card.front.name = 'Mario';
    card.front.title = 'CEO';
    card.front.company = 'Acme';
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 2, h: 2 },
        name: { x: 0, y: 0, w: 2, h: 1 },
      },
    };
    const res = analyzeCard(card);
    expect(res.issues.some((i) => i.includes('sovrapposti'))).toBe(true);
  });

  it('ok su card completa senza collisioni', () => {
    const card = createEmptyCard();
    card.front.name = 'Mario';
    card.front.title = 'CEO';
    card.front.company = 'Acme';
    card.style.textColor = '#000000';
    card.style.bgColor = '#ffffff';
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 2, h: 2 },
        name: { x: 2, y: 0, w: 2, h: 1 },
      },
    };
    card.backGrid = { cols: 4, rows: 4, elements: {} };
    const res = analyzeCard(card);
    expect(res.ok).toBe(true);
  });

  it('nessun falso positivo tra front e back (lati diversi)', () => {
    const card = createEmptyCard();
    card.front.name = 'Mario';
    card.front.title = 'CEO';
    card.front.company = 'Acme';
    card.style.textColor = '#000000';
    card.style.bgColor = '#ffffff';
    // photo (front) e contacts (back) occupano la STESSA cella ma su lati
    // diversi: NON è una collisione.
    card.grid = {
      cols: 4,
      rows: 4,
      elements: { photo: { x: 0, y: 0, w: 2, h: 4 } },
    };
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: { contacts: { x: 0, y: 0, w: 2, h: 1 } },
    };
    const res = analyzeCard(card);
    expect(res.issues.some((i) => i.includes('sovrapposti'))).toBe(false);
  });

  it('segnala collisioni reali nello stesso lato', () => {
    const card = createEmptyCard();
    card.front.name = 'Mario';
    card.front.title = 'CEO';
    card.front.company = 'Acme';
    card.style.textColor = '#000000';
    card.style.bgColor = '#ffffff';
    card.backGrid = {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 1 },
        qr: { x: 0, y: 0, w: 2, h: 4 },
      },
    };
    const res = analyzeCard(card);
    expect(res.issues.some((i) => i.includes('sovrapposti (back)'))).toBe(true);
  });
});
