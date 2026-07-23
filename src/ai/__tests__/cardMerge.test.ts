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

  it('merges grid.elements.qr position (C - AI grid move), Phase 2.2 routes to backGrid', () => {
    const card = createEmptyCard();
    // createEmptyCard ora include backGrid di default (gridPresetBackDefault)
    // con qr a (2,0,2,4) e contacts a (0,0,2,4). L'AI chiede qr a (0,2,1,2):
    // la mossa è bloccata da contacts (collisione), il merge sanitizza alla
    // posizione corrente. Verifichiamo routing backGrid + messaggio blocco.
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
    // (toMatchObject: il merge v2.0 preserva alignH/alignV/placement del
    // corrente, quindi l'elemento ha campi extra oltre a x/y/w/h)
    expect(merged.backGrid?.elements.qr).toMatchObject({ x: 2, y: 0, w: 1, h: 2 });
    expect(merged.grid?.elements.qr).toBeUndefined();
    expect(changes.some((c) => c.includes('qr'))).toBe(true);
  });

  it('merges grid.elements.photo size (C - AI grid resize)', () => {
    const card = createEmptyCard();
    // createEmptyCard ora include grid=gridPresetLeft con photo a (0,0,2,4).
    // AI chiede photo (0,0,2,2): nessuna collisione con name(2,0,2,1),
    // shrinkH a h=2 ok. Risultato: (0,0,2,2).
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 2 },
        },
      },
    });
    expect(merged.grid?.elements.photo).toMatchObject({ x: 0, y: 0, w: 2, h: 2 });
    expect(changes.some((c) => c.includes('photo'))).toBe(true);
  });

    it('merges grid.elements.logo position (Phase 2.1: logo is grid-editable)', () => {
      const card = createEmptyCard();
      // createEmptyCard include grid=gridPresetLeft con logo a (2,3,2,1).
      // AI chiede logo (2,3,1,1): larghezza ridotta a 1, nessuna collisione.
      // Risultato: (2,3,1,1).
      const { card: merged, changes } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            logo: { x: 2, y: 3, w: 1, h: 1 },
          },
        },
      });
      expect(merged.grid?.elements.logo).toMatchObject({ x: 2, y: 3, w: 1, h: 1 });
      expect(changes.some((c) => c.includes('logo'))).toBe(true);
    });

    it('AI grid change keeps card grid-ready (grid rendering is always active)', () => {
      const card = createEmptyCard();
      card.front.useGrid = false;
      card.grid = {
        cols: 4, rows: 4,
        elements: {
          name: { x: 0, y: 0, w: 4, h: 1 },
          logo: { x: 0, y: 2, w: 2, h: 1 },
        },
      };
      const { card: merged, changes } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            logo: { x: 2, y: 2, w: 2, h: 1 },
          },
        },
      });
      // Grid is now always the render source; AI changing elements still succeeds.
      expect(merged.grid?.elements.logo).toEqual({ x: 2, y: 2, w: 2, h: 1 });
      expect(changes.some((c) => /logo/i.test(c))).toBe(true);
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
        // "block", uso `logo` come blocco fittizio per testare la collisione
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
      // v2.17: il template Giovanni usa 'right-balanced' con photo a (2,1,2,2).
      // La mossa a x=0 è bloccata dalla colonna testi (name/title/company),
      // il resize a 1×1 è applicato → (2,1,1,1).
      expect(merged.grid?.elements.photo).toMatchObject({ x: 2, y: 1, w: 1, h: 1 });
    });

    it('preserves existing grid when AI only touches back elements', () => {
      const card = createGiovanniCardTemplate();
      const originalGrid = JSON.parse(JSON.stringify(card.grid));
      // L'AI chiede al qr di restare dov'è (nessuna mossa): solo conferma
      // posizione. L'assertion è che il front grid resta intatto.
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          elements: {
            qr: { x: 2, y: 0, w: 2, h: 4 }, // stessa posizione di Giovanni
          },
        },
      });
      expect(merged.grid).toEqual(originalGrid);
      // AI sends QR at (2,0,2,4); no back collision, so the resize is applied.
      expect(merged.backGrid?.elements.qr).toMatchObject({ x: 2, y: 0, w: 2, h: 4 });
    });

    it('uses existing backGrid (always present) when AI adds back elements (grid-only refactor)', () => {
      const card = createEmptyCard();
      // grid-only refactor: createEmptyCard include sempre backGrid
      // (gridPresetBackDefault). L'AI aggiunge qr, il merge usa la
      // backGrid esistente e sanitizza la posizione.
      expect(card.backGrid).toBeDefined();
      const { card: merged } = mergeCardAIResponse(card, {
        grid: {
          cols: 6,
          rows: 6,
          elements: {
            qr: { x: 0, y: 0, w: 1, h: 1 },
          },
        },
      });
      // backGrid: l'AI può aggiornare cols/rows (richiede 6x6). qr esistente
      // a (2,0,2,4) viene sanitizzato: moveX a x=0 bloccato da contacts,
      // shrinkH a h=1 ok → resta (2,0,1,1).
      expect(merged.backGrid?.cols).toBe(6);
      expect(merged.backGrid?.rows).toBe(6);
      expect(merged.backGrid?.elements.qr).toMatchObject({ x: 2, y: 0, w: 1, h: 1 });
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
        // Logo non raggiunge la posizione richiesta (photo a (0,0,2,4)
        // occupa lo spazio richiesto). Il merge reporta la collisione
        // come posizione parziale/bloccata invece di fingere di aver
        // raggiunto il target.
        expect(changes.some((c) => /logo.*(bloccato|parziale|collisione)/i.test(c))).toBe(true);
        // useGrid non è più il master switch del render; la grid è sempre
        // attiva, quindi il campo viene semplicemente mantenuto.
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

    it('useGrid: true esplicito viene mantenuto ma non più master switch', () => {
      const card = createGiovanniCardTemplate();
      const { card: merged } = mergeCardAIResponse(card, {
        front: { useGrid: true },
      });
      // useGrid è deprecato come master switch; la grid è sempre il layout.
      expect(merged.front.useGrid).toBe(true);
    });

    it('AI "metti logo sopra" con null elements: accetta null, applica campi non-grid', () => {
      // L'AI invia null per gli elementi non menzionati. Il merge deve
      // accettarli (filtro null nel preprocessore) e applicare le modifiche
      // non-grid (nome, titolo, accento, useGrid). Il logo è bloccato perché
      // la posizione richiesta (0,0,4,1) collide con photo (0,0,2,4), il
      // merge lo reporta come "bloccato" invece di fingere di averlo mosso.
      const card = {
        ...createGiovanniCardTemplate(),
        grid: {
          cols: 4, rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 2, h: 4 },
            name: { x: 2, y: 0, w: 2, h: 1 },
            title: { x: 2, y: 1, w: 2, h: 1 },
            company: { x: 2, y: 2, w: 2, h: 1 },
            logo: { x: 2, y: 3, w: 2, h: 1 },
          },
        },
      };
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
      // useGrid non è più il master switch; la grid è sempre attiva.
      expect(merged.front.useGrid).toBe(true);
      // Il logo è BLOCCATO (photo a (0,0,2,4) occupa lo spazio richiesto).
      // Il merge non finge di averlo mosso.
      expect(changes.some((c) => /logo.*bloccato/i.test(c))).toBe(true);
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
      // Sposta logo a (2, 3, 2, 1), spazio libero a destra
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
      // card.back ha phone/email reali e website=URL
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
      expect(merged.back.phone).toBe('35180008042');
      expect(merged.back.email).toBe('webdevcaglian@gmail.com');
      expect(merged.back.website).toBe('https://giovannicidu.vercel.app');
      expect(merged.back.qrPayload).toBe('');
      expect(merged.back.qrLabel).toBe('Scansiona per il mio sito');
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
      // back a (0,0,1,1), segnale di output casuale. Il merge deve
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
          company: '',
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
      expect(merged.back.phone).toBe('35180008042');
      expect(merged.back.email).toBe('webdevcaglian@gmail.com');
      expect(merged.back.website).toBe('https://giovannicidu.vercel.app');
      expect(merged.back.socials).toHaveLength(2);
      expect(merged.back.qrPayload).toBe('');
      // Modifiche accettate: solo style
      expect(merged.style.accentColor).toBe('#1e3a5f');
      expect(merged.style.fontFamily).toBe('Inter');
      expect(merged.style.borderStyle).toBe('accent-strip-left');
      // Modifiche accettate: layout (era 'split', AI dice 'centered', ma
      // poiché l'AI ha cancellato photoUrl, il layout dovrebbe restare 'split'.
      // Tuttavia la nostra protezione photoUrl non influisce sul layout:
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

// ─── Spec card-nudge v2.0 (REQ-AI-002/003, REQ-TEST-001) ────────────────
describe('mergeCardAIResponse — placement (nudge/zoom) preservation', () => {
  it('preserves existing placement/photoPlacement when AI moves only x/y/w/h (regression)', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: {
          x: 0, y: 0, w: 2, h: 4,
          placement: { x: 0.3, y: -0.2, scale: 1.4 },
          photoPlacement: { x: 0.1, y: 0.1, scale: 1.2 },
        },
        name: { x: 2, y: 0, w: 2, h: 1 },
      },
    };
    // L'AI ridimensiona la foto SENZA menzionare placement
    const { card: merged } = mergeCardAIResponse(card, {
      grid: { elements: { photo: { x: 0, y: 0, w: 2, h: 2 } } },
    });
    expect(merged.grid?.elements.photo?.w).toBe(2);
    expect(merged.grid?.elements.photo?.h).toBe(2);
    // placement e photoPlacement NON devono essere persi nel merge
    expect(merged.grid?.elements.photo?.placement).toEqual({ x: 0.3, y: -0.2, scale: 1.4 });
    expect(merged.grid?.elements.photo?.photoPlacement).toEqual({ x: 0.1, y: 0.1, scale: 1.2 });
  });

  it('preserves existing alignH/alignV when AI moves only x/y/w/h', () => {
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        name: { x: 0, y: 0, w: 2, h: 1, alignH: 'right', alignV: 'bottom' },
      },
    };
    const { card: merged } = mergeCardAIResponse(card, {
      grid: { elements: { name: { x: 2, y: 0, w: 2, h: 1 } } },
    });
    expect(merged.grid?.elements.name?.x).toBe(2);
    expect(merged.grid?.elements.name?.alignH).toBe('right');
    expect(merged.grid?.elements.name?.alignV).toBe('bottom');
  });

  it('accepts AI-provided placement (in bounds) and applies it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 4, placement: { x: 0.5, y: 0.5, scale: 1.5 } },
        },
      },
    });
    expect(merged.grid?.elements.photo?.placement).toEqual({ x: 0.5, y: 0.5, scale: 1.5 });
    expect(changes.some((c) => c.includes('photo'))).toBe(true);
  });

  it('placement-only change is tracked (not reported as collision block)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          // stessa posizione di gridPresetLeft.photo (0,0,2,3), cambia solo placement
          photo: { x: 0, y: 0, w: 2, h: 3, placement: { x: 0, y: 0, scale: 2 } },
        },
      },
    });
    expect(merged.grid?.elements.photo?.placement).toEqual({ x: 0, y: 0, scale: 2 });
    expect(changes.some((c) => /photo.*placement/.test(c))).toBe(true);
    expect(changes.some((c) => /photo.*bloccato/.test(c))).toBe(false);
  });

  it('rejects AI placement out of range via safeParse (scale 5 → card unchanged)', () => {
    const card = createEmptyCard();
    const originalGrid = JSON.parse(JSON.stringify(card.grid));
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 2, placement: { x: 0, y: 0, scale: 5 } },
        },
      },
    });
    // Lo schema ha range stretti: placement invalido → safeParse fallisce →
    // nessuna modifica applicata (mai crash, mai campo strippato).
    expect(merged.grid).toEqual(originalGrid);
    expect(changes).toHaveLength(0);
  });

  it('accepts front.layout "right-balanced" (passes validation and merge)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { layout: 'right-balanced' },
    });
    expect(merged.front.layout).toBe('right-balanced');
    expect(changes.some((c) => c.includes('right-balanced'))).toBe(true);
  });
});
