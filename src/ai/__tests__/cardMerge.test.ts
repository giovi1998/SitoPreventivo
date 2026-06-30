import { describe, it, expect } from 'vitest';
import { mergeCardAIResponse } from '../cardMerge';
import { createEmptyCard, createGiovanniCardTemplate } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';

describe('mergeCardAIResponse', () => {
  it('returns the same card if no modifications', () => {
    const card = createGiovanniCardTemplate();
    const { card: merged, changes } = mergeCardAIResponse(card, {});
    expect(changes).toHaveLength(0);
    expect(merged.front.name).toBe(card.front.name);
  });

  it('merges front.name change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { name: 'MARIO ROSSI' },
    });
    expect(merged.front.name).toBe('MARIO ROSSI');
    expect(changes.some((c) => c.includes('nome') && c.includes('MARIO ROSSI'))).toBe(true);
  });

  it('merges back.phone change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      back: { phone: '+39 333 1234567' },
    });
    expect(merged.back.phone).toBe('+39 333 1234567');
    expect(changes.some((c) => c.includes('telefono'))).toBe(true);
  });

  it('merges style.accentColor change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      style: { accentColor: '#1e3a5f' },
    });
    expect(merged.style.accentColor).toBe('#1e3a5f');
    expect(changes.some((c) => c.includes('accentColor') || c.includes('accent'))).toBe(true);
  });

  it('merges front.layout change (enum)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { layout: 'split' },
    });
    expect(merged.front.layout).toBe('split');
    expect(changes.some((c) => c.includes('layout'))).toBe(true);
  });

  it('merges back.socials array (replace)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      back: { socials: [{ platform: 'GitHub', url: '@mario' }] },
    });
    expect(merged.back.socials).toEqual([{ platform: 'GitHub', url: '@mario' }]);
    expect(changes.some((c) => c.includes('social'))).toBe(true);
  });

  it('preserves id, documentType, createdAt, userEmail', () => {
    const card = createGiovanniCardTemplate();
    card.userEmail = 'user@test.com';
    const { card: merged } = mergeCardAIResponse(card, { front: { name: 'X' } });
    expect(merged.id).toBe(card.id);
    expect(merged.documentType).toBe('businessCard');
    expect(merged.createdAt).toBe(card.createdAt);
    expect(merged.userEmail).toBe('user@test.com');
  });

  it('updates updatedAt when changes are applied', () => {
    const card = createEmptyCard();
    card.updatedAt = '2020-01-01T00:00:00.000Z'; // force old timestamp
    const { card: merged } = mergeCardAIResponse(card, { front: { name: 'X' } });
    expect(merged.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('does NOT update updatedAt when no changes', () => {
    const card = createEmptyCard();
    const originalUpdatedAt = card.updatedAt;
    const { card: merged } = mergeCardAIResponse(card, {});
    expect(merged.updatedAt).toBe(originalUpdatedAt);
  });

  it('does NOT overwrite photoUrl/logoUrl (preserves user-uploaded base64)', () => {
    const card: BusinessCard = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,USERPHOTO', logoUrl: 'data:image/png;base64,USERLOGO' },
    };
    const { card: merged } = mergeCardAIResponse(card, {
      front: { photoUrl: null, logoUrl: null, name: 'X' },
    });
    expect(merged.front.photoUrl).toBe('data:image/png;base64,USERPHOTO');
    expect(merged.front.logoUrl).toBe('data:image/png;base64,USERLOGO');
  });

  it('merges multiple sections at once (front + back + style)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { name: 'Mario', layout: 'centered' },
      back: { phone: '+39 333', website: 'https://x.com' },
      style: { accentColor: '#FF0000', borderStyle: 'thin' },
    });
    expect(merged.front.name).toBe('Mario');
    expect(merged.front.layout).toBe('centered');
    expect(merged.back.phone).toBe('+39 333');
    expect(merged.back.website).toBe('https://x.com');
    expect(merged.style.accentColor).toBe('#FF0000');
    expect(merged.style.borderStyle).toBe('thin');
    expect(changes.length).toBeGreaterThanOrEqual(6);
  });

  it('merges grid.elements.qr position (C - AI grid move) — Phase 2.2 routes to backGrid', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          qr: { x: 0, y: 2, w: 1, h: 2 },
        },
      },
    });
    // Phase 2.2 REQ-A04: qr è un elemento del retro, va in card.backGrid
    expect(merged.backGrid?.elements.qr).toEqual({ x: 0, y: 2, w: 1, h: 2 });
    expect(merged.grid?.elements.qr).toBeUndefined();
    expect(changes.some((c) => c.includes('qr'))).toBe(true);
  });

  it('merges grid.elements.photo size (C - AI grid resize)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 2 },
        },
      },
    });
    expect(merged.grid?.elements.photo).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(changes.some((c) => c.includes('photo'))).toBe(true);
  });

    it('merges grid.elements.logo position (Phase 2.1: logo is grid-editable)', () => {
      const card = createEmptyCard();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        grid: {
          elements: {
          logo: { x: 2, y: 3, w: 1, h: 1 },
        },
      },
    });
      expect(merged.grid?.elements.logo).toEqual({ x: 2, y: 3, w: 1, h: 1 });
      expect(changes.some((c) => c.includes('logo'))).toBe(true);
    });

    it('AI grid change auto-enables front.useGrid so preview can switch to grid-mode', () => {
      const card = createGiovanniCardTemplate();
      card.front.useGrid = false;
      const { card: merged, changes } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            logo: { x: 2, y: 0, w: 2, h: 1 },
          },
        },
      });
      expect(merged.front.useGrid).toBe(true);
      expect(changes.some((c) => /griglia attivata/i.test(c))).toBe(true);
    });

  it('AI grid move that would collide is sanitized to nearest valid position (BLOCK + clamp)', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 1, w: 3, h: 1 },
        title: { x: 1, y: 2, w: 3, h: 1 },
      },
    };
    // AI prova a spostare name a x=0 (colliderebbe con photo)
    const { card: merged } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          name: { x: 0, y: 1, w: 3, h: 1 },
        },
      },
    });
    // Il merge deve sanitizzare: x resta 1 (no collisione)
    expect(merged.grid?.elements.name?.x).toBe(1);
  });

  it('AI grid resize that would collide is sanitized with gradual per-axis clamp (Phase 2.2 REQ-A06)', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 0, w: 1, h: 1 },
        // title spostato a y=2 per non bloccare h=2 di name
        title: { x: 1, y: 2, w: 1, h: 1 },
      },
    };
    // AI prova a ingrandire name a w=3, h=3 (title a y=2 blocca h a 2)
    const { card: merged } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          name: { x: 1, y: 0, w: 3, h: 3 },
        },
      },
    });
    // REQ-A06: gradual clamp per-asse. w può crescere fino a 3 (nessun
    // blocco in larghezza), h si ferma a 2 (title a y=2 blocca h=3).
    expect(merged.grid?.elements.name?.w).toBe(3);
    expect(merged.grid?.elements.name?.h).toBe(2);
  });

  it('AI grid move multi-step with final collision advances until last valid cell (Phase 2.2 REQ-A06)', () => {
    // Setup: cols=6, name a x=0 vuole x=5 ma c'è un blocco a x=3.
    // stepMove deve avanzare fino a x=2 (1 step oltre il blocco).
    const card = createEmptyCard();
    card.grid = {
      cols: 6,
      rows: 4,
      elements: {
        name: { x: 0, y: 1, w: 1, h: 1 },
        // "block" — uso `logo` come blocco fittizio per testare la collisione
        logo: { x: 3, y: 1, w: 1, h: 1 },
      },
    };
    const { card: merged } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          name: { x: 5, y: 1, w: 1, h: 1 },
        },
      },
    });
    // Step 1: x=1 OK. Step 2: x=2 OK. Step 3: x=3 collide con block. Stop a x=2.
    expect(merged.grid?.elements.name?.x).toBe(2);
  });

  // ─── Bug "Rendi premium" regression (Phase 2.1) ────────────────
  describe('Grid routing front vs back (Phase 2.2 REQ-A04)', () => {
    it('routes front elements (photo/name/title/company/logo) to card.grid', () => {
      const card = createEmptyCard();
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 2, h: 2 },
            name: { x: 0, y: 2, w: 4, h: 1 },
            title: { x: 0, y: 3, w: 4, h: 1 },
            logo: { x: 3, y: 0, w: 1, h: 1 },
          },
        },
      });
      expect(merged.grid?.elements.photo).toBeDefined();
      expect(merged.grid?.elements.name).toBeDefined();
      expect(merged.grid?.elements.title).toBeDefined();
      expect(merged.grid?.elements.logo).toBeDefined();
      // Nessun elemento front deve finire in backGrid
      expect(merged.backGrid?.elements.photo).toBeUndefined();
      expect(merged.backGrid?.elements.name).toBeUndefined();
      expect(merged.backGrid?.elements.title).toBeUndefined();
      expect(merged.backGrid?.elements.logo).toBeUndefined();
    });

    it('routes back elements (contacts/qr/socials) to card.backGrid', () => {
      const card = createEmptyCard();
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 3, h: 4 },
            qr: { x: 3, y: 0, w: 1, h: 2 },
            socials: { x: 3, y: 2, w: 1, h: 2 },
          },
        },
      });
      expect(merged.backGrid?.elements.contacts).toBeDefined();
      expect(merged.backGrid?.elements.qr).toBeDefined();
      expect(merged.backGrid?.elements.socials).toBeDefined();
      // Nessun elemento back deve finire in grid
      expect(merged.grid?.elements.contacts).toBeUndefined();
      expect(merged.grid?.elements.qr).toBeUndefined();
      expect(merged.grid?.elements.socials).toBeUndefined();
    });

    it('preserves existing backGrid when AI only touches front elements', () => {
      const card = createGiovanniCardTemplate();
      const originalBackGrid = JSON.parse(JSON.stringify(card.backGrid));
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            photo: { x: 0, y: 0, w: 1, h: 1 },
          },
        },
      });
      expect(merged.backGrid).toEqual(originalBackGrid);
      expect(merged.grid?.elements.photo).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    });

    it('preserves existing grid when AI only touches back elements', () => {
      const card = createGiovanniCardTemplate();
      const originalGrid = JSON.parse(JSON.stringify(card.grid));
      // L'AI chiede al qr di restare dov'è (nessuna mossa): solo conferma
      // posizione. L'assertion è che il front grid resta intatto.
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            qr: { x: 3, y: 0, w: 1, h: 2 }, // stessa posizione di Giovanni
          },
        },
      });
      expect(merged.grid).toEqual(originalGrid);
      expect(merged.backGrid?.elements.qr).toEqual({ x: 3, y: 0, w: 1, h: 2 });
    });

    it('initializes backGrid with cols/rows when AI adds back elements to a card without it', () => {
      const card = createEmptyCard();
      expect(card.backGrid).toBeUndefined();
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 6,
          rows: 6,
          elements: {
            qr: { x: 0, y: 0, w: 1, h: 1 },
          },
        },
      });
      expect(merged.backGrid?.cols).toBe(6);
      expect(merged.backGrid?.rows).toBe(6);
      expect(merged.backGrid?.elements.qr).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    });
  });

  // ─── Bug "Rendi premium" regression (Phase 2.1) ────────────────
  describe('Phase 2.2: new AI parity fields (REQ-I01)', () => {
    it('merges style.fontScale (number, clamped to [0.7, 1.5])', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        style: { fontScale: 1.3 },
      });
      expect(merged.style.fontScale).toBe(1.3);
      expect(changes.some((c) => /dimensione testo/i.test(c))).toBe(true);

      // Out-of-range values clamped
      const { card: merged2 } = mergeCardAIResponse(card, { style: { fontScale: 3.0 } });
      expect(merged2.style.fontScale).toBe(1.5);
      const { card: merged3 } = mergeCardAIResponse(card, { style: { fontScale: 0.1 } });
      expect(merged3.style.fontScale).toBe(0.7);
    });

    it('merges back.qrSize (enum)', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        back: { qrSize: 'small' },
      });
      expect(merged.back.qrSize).toBe('small');
      expect(changes.some((c) => /dimensione QR/i.test(c))).toBe(true);
    });

    it('merges back.servicesLabel (string)', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        back: { servicesLabel: 'I miei servizi' },
      });
      expect(merged.back.servicesLabel).toBe('I miei servizi');
      expect(changes.some((c) => /etichetta servizi/i.test(c))).toBe(true);
    });

    it('merges back.services (array, max 8 items, max 80 chars each)', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        back: { services: ['Web Design', 'SEO', 'Consulenza'] },
      });
      expect(merged.back.services).toEqual(['Web Design', 'SEO', 'Consulenza']);
      expect(changes.some((c) => /servizi aggiornati/i.test(c))).toBe(true);
    });

    it('clamps back.services to 8 items and 80 chars per item', () => {
      const card = createGiovanniCardTemplate();
      const longText = 'a'.repeat(100);
      // 9 short items + 1 long item (index 8), in modo che dopo slice(0, 8)
      // l'8° item (index 7) sia il long text troncato a 80 char.
      const { card: merged } = mergeCardAIResponse(card, {
        back: { services: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', longText, 'S9', 'S10'] },
      });
      expect(merged.back.services).toHaveLength(8);
      // L'8° elemento (index 7) è il long text troncato a 80 char
      expect(merged.back.services[7]).toHaveLength(80);
      expect(merged.back.services[7]).toBe('a'.repeat(80));
    });

    it('AI cannot clear existing services with empty array (anti-hallucination)', () => {
      // Se l'AI invia [] esplicitamente, NON sovrascriviamo i servizi esistenti.
      const card = createGiovanniCardTemplate();
      card.back.services = ['Esistente1', 'Esistente2'];
      const { card: merged } = mergeCardAIResponse(card, {
        back: { services: [] as never },
      });
      expect(merged.back.services).toEqual(['Esistente1', 'Esistente2']);
    });

    // ─── Bug AI parity: l'AI invia `null` per elementi grid che non vuole
    // toccare, ma lo schema Zod rifiuta `null` su elementi opzionali,
    // invalidando TUTTA la risposta. Repro esatto del log utente:
    // "Metti sopra rispetto al logo" con grid.elements.logo: {0,0,4,1}
    // e tutti gli altri elementi a null.
    describe('AI grid elements null handling (regression: "Metti sopra al logo")', () => {
      it('accetta grid.elements con null per elementi non menzionati', () => {
        // Questo è esattamente l'output AI del log: l'AI vuole spostare
        // solo il logo, invia `null` per gli altri.
        const card = createGiovanniCardTemplate();
        const aiOutput = {
          front: {
            name: 'Antonio Ruggeri',
            title: 'Impresa Edile',
            layout: 'centered',
            useGrid: true,
          },
          style: { accentColor: '#1e3a5f' },
          grid: {
            cols: 4,
            rows: 4,
            elements: {
              photo: null,    // null ≡ "non toccare"
              name: null,
              title: null,
              company: null,
              logo: { x: 0, y: 0, w: 4, h: 1 },  // SOPRA
              qr: null,
              contacts: null,
              socials: null,
            },
          },
        };
        const { card: merged, changes } = mergeCardAIResponse(card, aiOutput as unknown as Record<string, unknown>);
        // La validazione NON deve fallire
        expect(changes.length).toBeGreaterThan(0);
        // Logo PARZIALE (photo a (0,0,2,4) occupa lo spazio richiesto).
        // Il merge NON finge di aver raggiunto la posizione richiesta.
        expect(changes.some((c) => /logo.*parziale/i.test(c))).toBe(true);
        // useGrid attivato
        expect(merged.front.useGrid).toBe(true);
        // Modifiche tracciate
        expect(changes).toEqual(expect.arrayContaining([
          expect.stringMatching(/nome/),
          expect.stringMatching(/titolo/),
          expect.stringMatching(/accento/),
        ]));
      });

      it('accetta grid.elements con null solo per logo (caso iniziale)', () => {
        const card = createGiovanniCardTemplate();
        const { card: merged } = mergeCardAIResponse(card, {
          front: { useGrid: true },
          grid: {
            cols: 4,
            rows: 4,
            elements: {
              photo: null,
              name: null,
              title: null,
              company: null,
              logo: null,  // AI non ha modificato il logo, solo lo spazio
              qr: null,
              contacts: null,
              socials: null,
            },
          },
        } as unknown as Record<string, unknown>);
        // Nessun crash, grid vuota mantenuta
        expect(merged.grid).toBeDefined();
      });

    it('useGrid: true esplicito viene propagato (anche senza grid.elements)', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        front: { useGrid: true },
      });
      expect(merged.front.useGrid).toBe(true);
      expect(changes.some((c) => /griglia attivata/i.test(c))).toBe(true);
    });

    it('AI "metti logo sopra" con null elements: accetta null, applica campi non-grid', () => {
      // L'AI invia null per gli elementi non menzionati. Il merge deve
      // accettarli (filtro null nel preprocessore) e applicare le modifiche
      // non-grid (nome, titolo, accento, useGrid). Il logo è bloccato perché
      // la posizione richiesta (0,0,4,1) collide con photo (0,0,2,4) — il
      // merge lo reporta come "bloccato" invece di fingere di averlo mosso.
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        front: { useGrid: true, name: 'Antonio Ruggeri', title: 'Impresa Edile' },
        style: { accentColor: '#1e3a5f' },
        grid: {
          cols: 4, rows: 4,
          elements: {
            photo: null, name: null, title: null, company: null,
            logo: { x: 0, y: 0, w: 4, h: 1 },
            qr: null, contacts: null, socials: null,
          },
        },
      } as unknown as Record<string, unknown>);
      // Le modifiche non-grid sono applicate
      expect(merged.front.name).toBe('Antonio Ruggeri');
      expect(merged.front.title).toBe('Impresa Edile');
      expect(merged.style.accentColor).toBe('#1e3a5f');
      expect(merged.front.useGrid).toBe(true);
      // Il logo è PARZIALE (photo occupa lo spazio). L'AI deve re-inviare
      // con una posizione libera o spostando anche photo.
      expect(changes.some((c) => /logo.*parziale/i.test(c))).toBe(true);
    });

    it('AI sposta logo in posizione libera → mossa applicata', () => {
      const card: BusinessCard = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'Test', logoUrl: 'data:image/png;base64,x' },
        grid: {
          cols: 4, rows: 4,
          elements: {
            name: { x: 0, y: 0, w: 4, h: 1 },
            logo: { x: 0, y: 3, w: 2, h: 1 },
          },
        },
      };
      // Sposta logo a (2, 3, 2, 1) — spazio libero a destra
      const { card: merged, changes } = mergeCardAIResponse(card, {
        grid: { cols: 4, rows: 4, elements: { logo: { x: 2, y: 3, w: 2, h: 1 } } },
      } as unknown as Record<string, unknown>);
      expect(merged.grid?.elements.logo).toEqual({ x: 2, y: 3, w: 2, h: 1 });
      expect(changes.some((c) => /logo.*posizionato/i.test(c))).toBe(true);
    });
  });
  });

  // ─── Bug "Rendi premium" regression (Phase 2.1) ────────────────
  describe('AI hallucination protection (Phase 2.1)', () => {
    it('strips unknown fields like "visible" (Zod schema enforcement)', () => {
      // L'AI spesso inventa campi tipo `visible`, `enabled`, ecc. che non
      // esistono nello schema. Zod li strippa automaticamente.
      const card = createGiovanniCardTemplate();
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 1, h: 1, visible: false },
          } as never,
        },
      });
      // photo NON è stato modificato (visible non è nel GridRect valido)
      // Inoltre, con `visible: false`, photo non viene toccato perché non
      // è un campo riconosciuto.
      const photoEl = merged.grid?.elements.photo;
      if (photoEl) {
        expect(photoEl).not.toHaveProperty('visible');
      }
    });

    it('does NOT clear back fields with empty string (preserves user data)', () => {
      const card = createGiovanniCardTemplate();
      // card.back ha phone/email="XXXXX" e website=URL
      const { card: merged } = mergeCardAIResponse(card, {
        back: {
          phone: '',
          email: '',
          website: '',
          qrPayload: '',
          qrLabel: '',
        },
      });
      // Nessun campo back deve essere stato sovrascritto
      expect(merged.back.phone).toBe('XXXXX');
      expect(merged.back.email).toBe('XXXXX');
      expect(merged.back.website).toBe('https://webdeveloperca.netlify.app/');
      expect(merged.back.qrPayload).toBe('https://webdeveloperca.netlify.app/');
      expect(merged.back.qrLabel).toBe('Scansiona per visitare il mio sito');
    });

    it('does NOT clear socials with empty array (preserves existing)', () => {
      const card = createGiovanniCardTemplate();
      // card.back.socials ha 2 elementi (LinkedIn, GitHub)
      const { card: merged } = mergeCardAIResponse(card, {
        back: { socials: [] as never },
      });
      expect(merged.back.socials).toHaveLength(2);
      expect(merged.back.socials[0].platform).toBe('LinkedIn');
    });

    it('detects AI hallucination: all back elements at (0,0,1,1) is rejected', () => {
      // Caso reale: AI "Rendi premium" ha inviato TUTTI gli elementi del
      // back a (0,0,1,1) — segnale di output casuale. Il merge deve
      // skippare le modifiche grid e preservare la backGrid corrente.
      const card = createGiovanniCardTemplate();
      const originalBackGrid = JSON.parse(JSON.stringify(card.backGrid));
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            qr: { x: 0, y: 0, w: 1, h: 1, visible: false },
            contacts: { x: 0, y: 0, w: 1, h: 1, visible: false },
            socials: { x: 0, y: 0, w: 1, h: 1, visible: false },
          } as never,
        },
      });
      // La backGrid corrente deve essere preservata
      expect(merged.backGrid).toEqual(originalBackGrid);
    });

    it('AI cannot clear user-uploaded photoUrl/logoUrl even with empty string', () => {
      const card = createGiovanniCardTemplate();
      // card.front.photoUrl = '/giovanni-photo.jpg' (utente)
      // card.front.logoUrl = data:image/svg+xml... (utente)
      const { card: merged } = mergeCardAIResponse(card, {
        front: {
          photoUrl: '',
          logoUrl: null,
        } as never,
      });
      expect(merged.front.photoUrl).toBe('/giovanni-photo.jpg');
      expect(merged.front.logoUrl).toMatch(/^data:image\/svg\+xml/);
    });

    it('full "Rendi premium" attack vector: AI tries to clear everything', () => {
      // Caso reale: AI "Rendi premium" con tutti i bug insieme.
      const card = createGiovanniCardTemplate();
      const { card: merged, changes } = mergeCardAIResponse(card, {
        front: {
          name: 'GIOVANNI CIDU',
          title: 'Web Developer',
          company: 'HPE CDS',
          photoUrl: '',
          logoUrl: '',
          layout: 'centered',
        },
        back: {
          phone: '',
          email: '',
          website: '',
          address: '',
          vatNumber: '',
          socials: [],
          qrPayload: '',
          qrLabel: '',
        },
        style: {
          sizePreset: 'eu-85x55',
          bgColor: '#FFFFFF',
          textColor: '#1a1a2e',
          accentColor: '#1e3a5f',
          fontFamily: 'Inter',
          borderStyle: 'accent-strip-left',
        },
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 1, h: 1, visible: false },
            name: { x: 0, y: 0, w: 4, h: 2 },
            title: { x: 0, y: 2, w: 4, h: 1 },
            company: { x: 0, y: 3, w: 4, h: 1 },
            logo: { x: 3, y: 3, w: 1, h: 1, visible: false },
            qr: { x: 0, y: 0, w: 1, h: 1, visible: false },
            contacts: { x: 0, y: 0, w: 1, h: 1, visible: false },
            socials: { x: 0, y: 0, w: 1, h: 1, visible: false },
          } as never,
        },
      });
      // User data preservato
      expect(merged.front.photoUrl).toBe('/giovanni-photo.jpg');
      expect(merged.front.logoUrl).toMatch(/^data:image\/svg\+xml/);
      expect(merged.back.phone).toBe('XXXXX');
      expect(merged.back.email).toBe('XXXXX');
      expect(merged.back.website).toBe('https://webdeveloperca.netlify.app/');
      expect(merged.back.socials).toHaveLength(2);
      expect(merged.back.qrPayload).toBe('https://webdeveloperca.netlify.app/');
      // Modifiche accettate: solo style
      expect(merged.style.accentColor).toBe('#1e3a5f');
      expect(merged.style.fontFamily).toBe('Inter');
      expect(merged.style.borderStyle).toBe('accent-strip-left');
      // Modifiche accettate: layout (era 'split', AI dice 'centered', ma
      // poiché l'AI ha cancellato photoUrl, il layout dovrebbe restare 'split'.
      // Tuttavia la nostra protezione photoUrl non influisce sul layout —
      // l'AI esplicitamente dice 'centered' e noi lo accettiamo.
      // NOTA: questo è un trade-off: proteggiamo photoUrl ma non blocchiamo
      // il layout se l'AI lo cambia esplicitamente. L'utente può riapplicare
      // il template Giovanni per ripristinare 'split'.
      expect(merged.front.layout).toBe('centered');
      // Phase 2.2 REQ-A04: gli elementi back (qr/contacts/socials) sono
      // instradati su backGrid e protetti dal gradual clamp (non possono
      // collidere con contacts che occupa 0-3). Le posizioni finali sono
      // l'esito del clamp, non dell'AI. L'utente può riapplicare il template
      // Giovanni per ripristinare il backGrid originale.
      expect(merged.backGrid?.cols).toBe(4);
      expect(merged.backGrid?.rows).toBe(4);
      // Changes tracciate
      expect(changes.length).toBeGreaterThan(0);
    });
  });
});
