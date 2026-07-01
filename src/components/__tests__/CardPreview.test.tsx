import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CardPreview from '../CardPreview';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetLeft, gridPresetSplit } from '../../utils/documentSchemas';
import type { BusinessCardLayout, BusinessCard } from '../../utils/documentSchemas';
import { generateQrSvg as mockedGenerateQrSvg } from '../../utils/qrGenerator';

vi.mock('../../utils/qrGenerator', () => ({
  generateQrSvg: vi.fn((qr: any) => {
    const payload = qr?.data?.payload || '';
    return `<svg data-testid="qr-svg" data-payload="${payload}"><rect/></svg>`;
  }),
  generateQrPng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
  isHttpUrl: (v: string) => /^https?:\/\//.test(v),
}));

describe('CardPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Front side', () => {
    it('renders the three layout variants (AC-003)', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'Mario Rossi', title: 'CEO', company: 'ACME' } };
      const { rerender } = render(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'left' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('layout-left');
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument();

      rerender(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'centered' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('layout-centered');

      rerender(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'split' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('layout-split');
    });

    it('renders Giovanni template with name visible', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="front" card={card} />);
      expect(screen.getByText(/GIOVANNI CIDU/)).toBeInTheDocument();
    });

    it('applies borderStyle class (REQ-007)', () => {
      const card = createEmptyCard();
      const { rerender } = render(<CardPreview side="front" card={card} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('border-accent-strip-left');

      rerender(<CardPreview side="front" card={{ ...card, style: { ...card.style, borderStyle: 'none' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('border-none');

      rerender(<CardPreview side="front" card={{ ...card, style: { ...card.style, borderStyle: 'thin' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('border-thin');

      rerender(<CardPreview side="front" card={{ ...card, style: { ...card.style, borderStyle: 'accent-strip-bottom' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('border-accent-strip-bottom');
    });

    it('applies size preset class (AC-011)', () => {
      const card = createEmptyCard();
      const { rerender } = render(<CardPreview side="front" card={card} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('size-eu-85x55');

      rerender(<CardPreview side="front" card={{ ...card, style: { ...card.style, sizePreset: 'square-65x65' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('size-square-65x65');

      rerender(<CardPreview side="front" card={{ ...card, style: { ...card.style, sizePreset: 'us-89x51' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('size-us-89x51');
    });

    it('renders photo when photoUrl is set', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,AAAA' } };
      render(<CardPreview side="front" card={card} />);
      const img = screen.getByAltText(/Foto del titolare/i);
      expect(img).toBeInTheDocument();
    });

    it('does NOT render monogram (removed feature) when name is set but no photo', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'GIOVANNI CIDU' } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-monogram-front')).toBeNull();
    });

    it('does NOT render monogram when name is empty', () => {
      const card = createEmptyCard();
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-monogram-front')).toBeNull();
    });

    it('does NOT render photo placeholder when no photo and no logo in left layout', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI', layout: 'left' as BusinessCardLayout } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-photo-placeholder')).toBeNull();
    });

    it('does NOT render split filler when no photo and no logo in split layout', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI', layout: 'split' as BusinessCardLayout } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-split-filler')).toBeNull();
    });

    it('does NOT show monogram when photo is present', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI', photoUrl: 'data:image/png;base64,AAAA', layout: 'left' as BusinessCardLayout },
      };
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryAllByTestId('card-monogram-front')).toHaveLength(0);
    });

    it('renders bottom area with handle/domain in left layout', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
      };
      const { container } = render(<CardPreview side="front" card={card} />);
      const bottom = container.querySelector('.card-front-left-bottom');
      expect(bottom).toBeInTheDocument();
    });

    it('renders decorative diagonal pattern in top-right of front card', () => {
      const card = createEmptyCard();
      const { container } = render(<CardPreview side="front" card={card} />);
      const front = container.querySelector('.card-preview-front')!;
      // Pattern can be a CSS gradient or inline svg, check for either
      const hasGradient = window.getComputedStyle(front).getPropertyValue('--card-accent') !== '';
      expect(hasGradient).toBe(true);
    });

    it('renders accent divider line below text block on front', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI' } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.getByTestId('card-accent-divider')).toBeInTheDocument();
    });
  });

  describe('Back side', () => {
    it('renders contact details and socials (Phase 2.1: WEB omitted when QR present)', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          phone: '+39 333 1234567',
          email: 'mario@acme.com',
          website: 'https://acme.com',
          address: 'Via Roma 1',
          vatNumber: 'IT01234567890',
        },
      };
      render(<CardPreview side="back" card={card} />);
      // Telefono/Email/Indirizzo/P.IVA presenti (WEB omessa perché QR presente)
      expect(screen.getByText('+39 333 1234567')).toBeInTheDocument();
      expect(screen.getByText('mario@acme.com')).toBeInTheDocument();
      expect(screen.getByText('Via Roma 1')).toBeInTheDocument();
      expect(screen.getByText('IT01234567890')).toBeInTheDocument();
      // Il website è nel header wordmark, non come riga contatto separata
    });

    it('auto-generates QR from website when qrPayload is empty (AC-007)', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, qrPayload: '', website: 'https://example.com' },
      };
      render(<CardPreview side="back" card={card} />);
      expect(mockedGenerateQrSvg).toHaveBeenCalled();
      const lastCallArg = (mockedGenerateQrSvg as any).mock.calls.slice(-1)[0][0];
      expect(lastCallArg.data.payload).toBe('https://example.com');
    });

    it('uses custom qrPayload when populated (AC-008)', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, qrPayload: 'MATMSG:custom', website: 'https://example.com' },
      };
      render(<CardPreview side="back" card={card} />);
      expect(mockedGenerateQrSvg).toHaveBeenCalled();
      const lastCallArg = (mockedGenerateQrSvg as any).mock.calls.slice(-1)[0][0];
      expect(lastCallArg.data.payload).toBe('MATMSG:custom');
    });

    it('does NOT render QR when both qrPayload and website are empty (edge case 3)', () => {
      (mockedGenerateQrSvg as any).mockClear();
      const card = createEmptyCard();
      render(<CardPreview side="back" card={card} />);
      expect(mockedGenerateQrSvg).not.toHaveBeenCalled();
    });

    it('renders QR synchronously on first render (regression: no placeholder flash)', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
      };
      const { container } = render(<CardPreview side="back" card={card} />);
      // Il QR SVG deve essere nel DOM al primo render (non dopo useEffect)
      expect(container.querySelector('[data-testid="card-back-qr-svg"] svg, .card-back-qr-svg svg, [data-payload]')).toBeTruthy();
    });

    it('renders back header with "Contatti" label when website is set', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByTestId('card-back-header')).toHaveTextContent(/Contatti/i);
    });

    it('omits the WEB contact row on the back when QR payload is present (Phase 2.1)', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://webdeveloperca.netlify.app' } };
      render(<CardPreview side="back" card={card} />);
      // Non deve esserci la riga "Web" con il valore del website quando il QR è attivo
      expect(screen.queryByText('https://webdeveloperca.netlify.app')).not.toBeInTheDocument();
    });

    it('shows the WEB contact row when no QR payload is present', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          website: '',
          phone: '+39 333',
          email: 'a@b.com',
        },
      };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByText('+39 333')).toBeInTheDocument();
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
    });

    it('hides back header when neither website nor company is set (C9)', () => {
      const card = createEmptyCard();
      render(<CardPreview side="back" card={card} />);
      expect(screen.queryByTestId('card-back-header')).toBeNull();
    });

    it('renders wordmark footer on back when website is set', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByTestId('card-back-wordmark')).toHaveTextContent('example.com');
    });

    it('falls back to company name in header when website is empty (C9)', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, company: 'ACME SRL' },
        back: { ...createEmptyCard().back, website: '' },
      };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByTestId('card-back-wordmark')).toHaveTextContent('ACME SRL');
    });

    it('uses extended keys for back contacts (C11: Telefono/Email/Web/Indirizzo/P.IVA)', () => {
      // Senza website (no QR) la WEB row è presente
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          phone: '+39 333 1234567',
          email: 'mario@acme.com',
          website: 'https://acme.com',
          qrPayload: 'FORCE_QR', // forziamo QR per testare la WEB row
          address: 'Via Roma 1',
          vatNumber: 'IT01234567890',
        },
      };
      render(<CardPreview side="back" card={card} />);
      const back = screen.getByTestId('card-preview-back');
      expect(back.textContent).toContain('Telefono');
      expect(back.textContent).toContain('Email');
      // (Web omessa perché QR presente)
      expect(back.textContent).toContain('Indirizzo');
      expect(back.textContent).toContain('P.IVA');
    });

    it('shows WEB row in back contacts when website is set and no QR is generated (qrPayload empty)', () => {
      // Con qrPayload vuoto, resolveCardQrPayload ritorna '' (no QR).
      // Quindi WEB row visibile.
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          website: '', // website vuoto = niente QR auto-derivato
          phone: '+39 333',
          email: 'a@b.com',
        },
      };
      render(<CardPreview side="back" card={card} />);
      const back = screen.getByTestId('card-preview-back');
      expect(back.textContent).toContain('Telefono');
      expect(back.textContent).toContain('Email');
      // (WEB assente perché website vuoto, verificato sotto)
    });

    it('renders socials as text handles in footer (not pill buttons, physical card)', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          socials: [
            { platform: 'LinkedIn', url: 'https://linkedin.com/in/mario' },
            { platform: 'GitHub', url: 'https://github.com/mario' },
          ],
        },
      };
      render(<CardPreview side="back" card={card} />);
      const socials = screen.getByTestId('card-back-socials');
      // Should be a flat text node, not pill buttons
      expect(socials.querySelector('.card-back-social-pill')).toBeNull();
      // Should contain the @-handle derived from the URL
      expect(socials.textContent).toContain('@mario');
    });

    it('renders socials INSIDE the contacts column, not in a separate footer (below contacts)', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          socials: [
            { platform: 'LinkedIn', url: 'XXXX' },
          ],
        },
      };
      const { container } = render(<CardPreview side="back" card={card} />);
      const contacts = container.querySelector('.card-back-contacts')!;
      const socials = screen.getByTestId('card-back-socials');
      // Socials should be a child of contacts column
      expect(contacts.contains(socials)).toBe(true);
      // No more separate card-back-footer wrapper
      expect(container.querySelector('.card-back-footer')).toBeNull();
    });

    it('shows raw text in socials footer when URL is invalid (e.g. user typed "xx")', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          socials: [
            { platform: 'LinkedIn', url: 'xx' },
          ],
        },
      };
      render(<CardPreview side="back" card={card} />);
      const socials = screen.getByTestId('card-back-socials');
      // Should show "LinkedIn · xx" so the user knows which social the placeholder is for
      expect(socials.textContent).toContain('LinkedIn');
      expect(socials.textContent).toContain('xx');
    });
  });

  // ─── Grid-based rendering (Phase 2.2 REQ-E01: master switch `showGrid`) ─
  describe('Grid-based rendering', () => {
    it('front: showGrid=true + hasGridElements → renders with CSS Grid display', () => {
      // Phase 2.2 REQ-E01: il master switch `showGrid` è il controllo unico.
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      render(<CardPreview side="front" card={card} showGrid={true} />);
      const front = screen.getByTestId('card-preview-front');
      const style = window.getComputedStyle(front);
      expect(style.display).toBe('grid');
    });

    it('front: when card.grid is NOT set, falls back to flexbox (no grid)', () => {
      const card = createGiovanniCardTemplate();
      const noGrid = { ...card, grid: undefined as unknown as typeof card.grid };
      render(<CardPreview side="front" card={noGrid} />);
      const front = screen.getByTestId('card-preview-front');
      // Giovanni template usa layout: 'split' (Phase 2.1)
      expect(front).toHaveClass('layout-split');
    });

    it('front: grid element photo gets gridColumn/gridRow matching gridPresetLeft', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      render(<CardPreview side="front" card={card} showGrid={true} />);
      const photoEl = document.querySelector('[data-testid="grid-el-photo"]') as HTMLElement;
      expect(photoEl).not.toBeNull();
      const style = window.getComputedStyle(photoEl);
      // gridPresetLeft: photo at x=0, y=0, w=1, h=4 → gridColumn 1 / span 1, gridRow 1 / span 4
      expect(style.gridColumn).toBe('1 / span 1');
      expect(style.gridRow).toBe('1 / span 4');
    });

    it('front: moving name element changes its grid-column', () => {
      const grid = gridPresetLeft();
      // name is at x=1, w=3 in presetLeft
      const card1: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid,
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      const { rerender } = render(<CardPreview side="front" card={card1} showGrid={true} />);
      let nameEl = document.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(window.getComputedStyle(nameEl).gridColumn).toBe('2 / span 3');

      // Move name to x=0, w=2
      const grid2 = { ...grid, elements: { ...grid.elements, name: { x: 0, y: 0, w: 2, h: 1 } } };
      rerender(<CardPreview side="front" card={{ ...card1, grid: grid2 }} showGrid={true} />);
      nameEl = document.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(window.getComputedStyle(nameEl).gridColumn).toBe('1 / span 2');
    });

    it('back: showGrid=true + hasGridElements → renders QR and contacts via grid', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: { ...createGiovanniCardTemplate().back, useGrid: true },
        backGrid: gridPresetSplit(),
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      const back = screen.getByTestId('card-preview-back');
      const style = window.getComputedStyle(back);
      expect(style.display).toBe('grid');
      // gridPresetSplit Phase 2.1: qr at x=2, contacts at x=0 (w=2)
      const qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(qrEl).not.toBeNull();
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('3 / span 1');
      const contactsEl = document.querySelector('[data-testid="grid-el-contacts"]') as HTMLElement;
      expect(contactsEl).not.toBeNull();
      expect(window.getComputedStyle(contactsEl).gridColumn).toBe('1 / span 2');
    });

    it('back: socials renderizzati UNA sola volta in grid-mode (regression: no doppioni)', () => {
      // backGrid con sia `contacts` sia `socials`: i social devono comparire
      // SOLO nella cella socials, non anche dentro la cella contacts.
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          useGrid: true,
          socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/x' }],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            qr: { x: 2, y: 0, w: 2, h: 2 },
            socials: { x: 0, y: 2, w: 4, h: 2 },
          },
        },
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      // Deve esserci esattamente UN blocco social
      const socialsBlocks = document.querySelectorAll('[data-testid="card-back-socials"]');
      expect(socialsBlocks).toHaveLength(1);
      // E deve stare dentro la cella socials
      const socialsCell = document.querySelector('[data-testid="grid-el-socials"]');
      expect(socialsCell?.querySelector('[data-testid="card-back-socials"]')).not.toBeNull();
    });

    it('back: socials nel contacts cell come fallback se NON esiste cella socials', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          useGrid: true,
          socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/x' }],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 3, h: 4 },
            qr: { x: 3, y: 0, w: 1, h: 2 },
            // nessun elemento socials
          },
        },
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      const socialsBlocks = document.querySelectorAll('[data-testid="card-back-socials"]');
      expect(socialsBlocks).toHaveLength(1);
      const contactsCell = document.querySelector('[data-testid="grid-el-contacts"]');
      expect(contactsCell?.querySelector('[data-testid="card-back-socials"]')).not.toBeNull();
    });

    it('back: moving QR to x=0 changes its grid-column to 1', () => {
      const backGrid = gridPresetSplit();
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: { ...createGiovanniCardTemplate().back, useGrid: true },
        backGrid,
      };
      const { rerender } = render(<CardPreview side="back" card={card} showGrid={true} />);
      let qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('3 / span 1');

      const grid2 = { ...backGrid, elements: { ...backGrid.elements, qr: { x: 0, y: 2, w: 1, h: 2 } } };
      rerender(<CardPreview side="back" card={{ ...card, backGrid: grid2 }} showGrid={true} />);
      qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('1 / span 1');
    });

    it('back: when card.backGrid has no back elements, falls back to flexbox (Phase 2.1 fix)', () => {
      // Giovanni template: grid ha elementi front, backGrid ha elementi back.
      // Rimuovendo backGrid, il retro cade in flexbox.
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="back" card={{ ...card, backGrid: undefined }} showGrid={true} />);
      const back = screen.getByTestId('card-preview-back');
      // NOT in grid mode → flexbox → contacts/qr visible come flex
      expect(back.className).not.toContain('grid-mode');
      expect(screen.queryByTestId('grid-el-qr')).toBeNull();
      expect(screen.queryByTestId('grid-el-contacts')).toBeNull();
    });

    it('front: showGrid=false hides overlay but preserves persisted grid layout', () => {
      // UX fix: Griglia OFF non deve perdere la modifica salvata. OFF nasconde
      // solo overlay/controlli; se useGrid=true, il layout resta grid.
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      render(<CardPreview side="front" card={card} showGrid={false} />);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
      expect(document.querySelector('[data-testid="grid-el-photo"]')).not.toBeNull();
      expect(document.querySelector('.card-grid-overlay')).toBeNull();
    });

    it('front: showGrid=true + hasGridElements → grid-mode ATTIVO + overlay visibile (REQ-E01)', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      render(<CardPreview side="front" card={card} showGrid={true} />);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
      // photo è nel grid → renderizzato come grid element
      expect(document.querySelector('[data-testid="grid-el-photo"]')).not.toBeNull();
      // l'overlay È renderizzato (master switch ON)
      expect(document.querySelector('.card-grid-overlay')).not.toBeNull();
    });

    it('back: showGrid=false → flexbox (REQ-E01 master switch OFF)', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="back" card={card} showGrid={false} />);
      const back = screen.getByTestId('card-preview-back');
      expect(back.className).not.toContain('grid-mode');
      expect(document.querySelector('[data-testid="grid-el-qr"]')).toBeNull();
    });

    it('back: email su una sola riga (nowrap + ellipsis) senza QR', () => {
      // Senza QR i contatti si espandono a tutta la larghezza, ma la mail
      // lunga NON deve spezzarsi sull'@ (fix: rimosso word-break: break-word).
      // jsdom non applica pienamente whiteSpace/textOverflow via getComputedStyle,
      // quindi verifichiamo la struttura del DOM (l'email è un singolo text
      // node, NON spezzato) + la regola CSS è verificata da un check parallelo.
      const longEmail = 'mario.rossi.da.vimercate@agenzia-immobiliare-milano.it';
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          email: longEmail,
          qrPayload: '',
          qrLabel: '',
        },
      };
      const { container } = render(<CardPreview side="back" card={card} showGrid={false} />);
      const val = container.querySelector('[data-testid="card-back-email-val"]') as HTMLElement;
      // 1. L'email è effettivamente renderizzata come singolo text node (no split)
      expect(val).not.toBeNull();
      expect(val.textContent).toBe(longEmail);
      expect(val.childNodes.length).toBe(1);
      expect(val.firstChild?.nodeType).toBe(Node.TEXT_NODE);
      // 2. La regola .card-back-val contiene nowrap+ellipsis (verifica diretta
      //    del sorgente CSS, indipendente da jsdom/Vite CSS loading).
      //    Usiamo fs perché jsdom non vede sempre gli stylesheets di Vite.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path');
      const cssPath = path.resolve(__dirname, '../card/cardPreviewSide.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      // Estrai il blocco della regola .card-back-val { ... }
      const m = css.match(/\.card-back-val\s*\{([^}]+)\}/);
      expect(m).not.toBeNull();
      const block = m![1];
      expect(block).toMatch(/white-space:\s*nowrap/);
      expect(block).toMatch(/overflow:\s*hidden/);
      expect(block).toMatch(/text-overflow:\s*ellipsis/);
      // Critico: NON deve più esserci word-break: break-word
      expect(block).not.toMatch(/word-break:\s*break-word/);
    });

    it('front: grid renders logo element with data-testid grid-el-logo (Phase 2.1)', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        front: {
          ...createGiovanniCardTemplate().front,
          logoUrl: 'data:image/png;base64,iVBORw0KGgo=',
          useGrid: true,
        },
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            photo: { x: 0, y: 0, w: 2, h: 2 },
            logo: { x: 2, y: 0, w: 2, h: 2 },
            name: { x: 0, y: 2, w: 4, h: 1 },
            title: { x: 0, y: 3, w: 4, h: 1 },
          },
        },
      };
      render(<CardPreview side="front" card={card} showGrid={true} />);
      const logoEl = document.querySelector('[data-testid="grid-el-logo"]') as HTMLElement;
      expect(logoEl).not.toBeNull();
      expect(logoEl.querySelector('img.card-logo')).not.toBeNull();
      expect(window.getComputedStyle(logoEl).gridColumn).toBe('3 / span 2');
      expect(window.getComputedStyle(logoEl).gridRow).toBe('1 / span 2');
    });
  });

  // ─── Phase 2.2: fontScale + servicesLabel + text wrap ────────────
  describe('Phase 2.2 features (fontScale, servicesLabel, wrap)', () => {
    it('front: applies --card-font-scale CSS variable from style.fontScale', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        style: { ...createGiovanniCardTemplate().style, fontScale: 1.2 },
      };
      render(<CardPreview side="front" card={card} />);
      const front = screen.getByTestId('card-preview-front');
      // fontScale 1.2 → CSS var = "1.2"
      expect((front as HTMLElement).style.getPropertyValue('--card-font-scale')).toBe('1.2');
    });

    it('back: shows servicesLabel heading above services list', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          services: ['Web Design', 'SEO'],
          servicesLabel: 'I miei servizi',
        },
      };
      render(<CardPreview side="back" card={card} />);
      const label = screen.getByTestId('card-back-services-label');
      expect(label).toBeInTheDocument();
      expect(label.textContent).toBe('I miei servizi');
    });

    it('back: empty servicesLabel does NOT render the heading', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          services: ['Web Design'],
          servicesLabel: '',
        },
      };
      render(<CardPreview side="back" card={card} />);
      expect(screen.queryByTestId('card-back-services-label')).toBeNull();
    });

    it('back: long services trigger --long modifier for auto-shrink (REQ-F03)', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          services: [
            'Sviluppo di applicazioni web moderne e performanti con tecnologie all avanguardia',
          ],
        },
      };
      render(<CardPreview side="back" card={card} />);
      const list = screen.getByTestId('card-back-services');
      expect(list.className).toContain('card-back-services--long');
    });

    it('back: --card-qr-size CSS variable reflects card.back.qrSize', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: { ...createGiovanniCardTemplate().back, qrSize: 'small' },
      };
      render(<CardPreview side="back" card={card} />);
      const back = screen.getByTestId('card-preview-back');
      // qrSize: small → "84px"
      expect((back as HTMLElement).style.getPropertyValue('--card-qr-size')).toBe('84px');
    });
  });
});
