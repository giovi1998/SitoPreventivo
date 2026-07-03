import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CardPreview from '../CardPreview';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetLeft, gridPresetSplit, gridPresetBackDefault } from '../../utils/documentSchemas';
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
    it('always renders via CSS Grid regardless of layout variant (AC-003, grid-only refactor)', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'Mario Rossi', title: 'CEO', company: 'ACME' } };
      const { rerender } = render(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'left' } }} />);
      const frontLeft = screen.getByTestId('card-preview-front');
      expect(frontLeft).toHaveClass('grid-mode');
      expect(window.getComputedStyle(frontLeft).display).toBe('grid');
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument();

      rerender(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'centered' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('grid-mode');

      rerender(<CardPreview side="front" card={{ ...card, front: { ...card.front, layout: 'split' } }} />);
      expect(screen.getByTestId('card-preview-front')).toHaveClass('grid-mode');
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

    it('renders front grid-mode always (no more flexbox .card-front-left-bottom)', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
      };
      const { container } = render(<CardPreview side="front" card={card} />);
      // grid-only refactor: .card-front-left-bottom non esiste più, la card
      // è sempre in grid-mode.
      expect(container.querySelector('.card-front-left-bottom')).toBeNull();
      expect(screen.getByTestId('card-preview-front')).toHaveClass('grid-mode');
    });

    it('renders decorative diagonal pattern in top-right of front card', () => {
      const card = createEmptyCard();
      const { container } = render(<CardPreview side="front" card={card} />);
      const front = container.querySelector('.card-preview-front')!;
      // Pattern can be a CSS gradient or inline svg, check for either
      const hasGradient = window.getComputedStyle(front).getPropertyValue('--card-accent') !== '';
      expect(hasGradient).toBe(true);
    });

    it('no longer renders flexbox-only accent divider (grid-only refactor)', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI' } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-accent-divider')).toBeNull();
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

    it('renders back header with website wordmark (grid refactor)', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByTestId('card-back-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-back-wordmark')).toHaveTextContent('example.com');
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

    it('renders back wordmark inside header (grid refactor)', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      const { container } = render(<CardPreview side="back" card={card} />);
      const wordmark = screen.getByTestId('card-back-wordmark');
      expect(wordmark).toBeInTheDocument();
      expect(wordmark).toHaveTextContent('example.com');
      expect(container.querySelector('.card-back-header')?.contains(wordmark)).toBe(true);
    });

    it('renders back wordmark fallback from company when no website (grid refactor, C9)', () => {
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

    it('renders socials INSIDE the contacts grid cell when no socials cell exists (grid-only refactor)', () => {
      const card = {
        ...createEmptyCard(),
        back: {
          ...createEmptyCard().back,
          socials: [
            { platform: 'LinkedIn', url: 'XXXX' },
          ],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 3, h: 4 },
            qr: { x: 3, y: 0, w: 1, h: 2 },
          },
        },
      };
      const { container } = render(<CardPreview side="back" card={card} />);
      const contactsCell = container.querySelector('[data-testid="grid-el-contacts"]');
      const socials = screen.getByTestId('card-back-socials');
      expect(contactsCell?.contains(socials)).toBe(true);
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

    it('front: grid is ALWAYS used (grid-only refactor, no flexbox fallback)', () => {
      // grid-only: card.grid è sempre presente (createEmptyCard lo include).
      // Anche se forziamo grid=undefined, il render usa card.grid ?? backGrid
      // e resta in grid-mode. Verifichiamo che la card default sia grid-mode.
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="front" card={card} />);
      const front = screen.getByTestId('card-preview-front');
      expect(front).toHaveClass('grid-mode');
      expect(window.getComputedStyle(front).display).toBe('grid');
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
      // gridPresetLeft: photo at x=0, y=0, w=2, h=3 → gridColumn 1 / span 2, gridRow 1 / span 3
      expect(style.gridColumn).toBe('1 / span 2');
      expect(style.gridRow).toBe('1 / span 3');
    });

    it('front: moving name element changes its grid-column', () => {
      const grid = gridPresetLeft();
      // name is at x=2, w=2 in presetLeft
      const card1: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid,
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      const { rerender } = render(<CardPreview side="front" card={card1} showGrid={true} />);
      let nameEl = document.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(window.getComputedStyle(nameEl).gridColumn).toBe('3 / span 2');

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
        backGrid: gridPresetBackDefault(),
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      // The back root is now a block container with a nested body grid.
      const back = screen.getByTestId('card-preview-back');
      expect(window.getComputedStyle(back).display).toBe('block');
      const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
      expect(bodyGrid).not.toBeNull();
      expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
      // gridPresetBackDefault: contacts at x=0 (w=2), qr at x=3 (w=1)
      const qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(qrEl).not.toBeNull();
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('4 / span 1');
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

    it('back: body grid container always renders (grid refactor, no flexbox body)', () => {
      // grid-only: backGrid è sempre presente in createEmptyCard. Anche
      // forzandolo undefined, BackPreview usa card.backGrid ?? card.grid.
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="back" card={{ ...card, backGrid: undefined }} showGrid={true} />);
      const back = screen.getByTestId('card-preview-back');
      const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
      expect(bodyGrid).not.toBeNull();
      expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
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

    it('back: showGrid=false hides debug overlay but keeps body grid (grid refactor)', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="back" card={card} showGrid={false} />);
      const back = screen.getByTestId('card-preview-back');
      // grid-only: showGrid controlla solo l'overlay, non il render branch.
      const bodyGrid = back.querySelector('.card-back-body-grid') as HTMLElement;
      expect(bodyGrid).not.toBeNull();
      expect(window.getComputedStyle(bodyGrid).display).toBe('grid');
      expect(document.querySelector('[data-testid="card-grid-debug"]')).toBeNull();
    });

    it('back: email renderizzata senza tagli e wrappata nella cella grid', () => {
      // In grid-mode preferiamo mostrare i dati di contatto: il valore può
      // andare a capo naturalmente dentro la cella invece di essere troncato
      // con ellissi. Senza QR i contatti si espandono a tutta la larghezza.
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
      expect(val).not.toBeNull();
      expect(val.textContent).toBe(longEmail);
      expect(val.childNodes.length).toBe(1);
      expect(val.firstChild?.nodeType).toBe(Node.TEXT_NODE);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('node:path') as typeof import('node:path');
      const cssPath = path.resolve(__dirname, '../card/cardPreviewSide.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      // In grid-mode le celle testuali wrappano i valori invece di troncarli.
      const mGrid = css.match(/\.card-preview-side\.grid-mode\s+\.card-grid-cell--text\s+\.card-back-val\s*\{([^}]+)\}/);
      expect(mGrid).not.toBeNull();
      const blockGrid = mGrid![1];
      expect(blockGrid).toMatch(/white-space:\s*normal/);
      expect(blockGrid).toMatch(/overflow-wrap:\s*break-word/);
      expect(blockGrid).toMatch(/word-break:\s*normal/);
    });

    it('front: alignment inline styles control text position', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        front: { ...createGiovanniCardTemplate().front, name: 'ALICE', title: '', company: '' },
        grid: {
          cols: 4,
          rows: 4,
          elements: {
            name: { x: 0, y: 0, w: 4, h: 1, alignH: 'left', alignV: 'top' },
          },
        },
      };
      const { container } = render(<CardPreview side="front" card={card} />);
      const nameCell = container.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(nameCell).not.toBeNull();
      const style = window.getComputedStyle(nameCell);
      expect(style.justifyContent).toBe('flex-start');
      expect(style.alignItems).toBe('flex-start');
    });

    it('back: services render in a separate grid cell when present', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: {
          ...createGiovanniCardTemplate().back,
          services: ['Consulenza', 'Supporto'],
        },
        backGrid: {
          cols: 4,
          rows: 4,
          elements: {
            contacts: { x: 0, y: 0, w: 2, h: 2 },
            services: { x: 0, y: 2, w: 2, h: 1 },
            qr: { x: 2, y: 0, w: 2, h: 4 },
          },
        },
      };
      render(<CardPreview side="back" card={card} />);
      expect(screen.getByTestId('grid-el-services')).toBeInTheDocument();
      expect(screen.getByTestId('grid-el-contacts')).toBeInTheDocument();
      expect(screen.getByTestId('card-back-services')).toBeInTheDocument();
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

    it('renders grid debug overlay on front when useGrid=true and front has grid elements', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
        front: { ...createGiovanniCardTemplate().front, useGrid: true },
      };
      render(<CardPreview side="front" card={card} showGrid={true} />);
      expect(screen.getByTestId('card-grid-debug')).toBeInTheDocument();
    });

    it('renders grid debug overlay on back when useGrid=true and back has grid elements', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        backGrid: gridPresetBackDefault(),
        back: { ...createGiovanniCardTemplate().back, useGrid: true },
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      expect(screen.getByTestId('card-grid-debug')).toBeInTheDocument();
    });

    it('does NOT render grid debug overlay in flexbox mode', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="front" card={card} showGrid={false} />);
      expect(screen.queryByTestId('card-grid-debug')).toBeNull();
    });

    it('back grid debug hides empty socials slot when back.socials is empty', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        backGrid: gridPresetBackDefault(),
        back: {
          ...createGiovanniCardTemplate().back,
          useGrid: true,
          services: ['Consulenza'],
          socials: [],
          phone: '3408613407',
          email: 'test@example.com',
          website: '',
          qrPayload: '',
        },
      };
      render(<CardPreview side="back" card={card} showGrid={true} />);
      expect(screen.getByTestId('card-grid-debug')).toBeInTheDocument();
      expect(screen.queryByText('socials')).toBeNull();
      // contacts and services should still appear
      expect(screen.getByText('contacts')).toBeInTheDocument();
      expect(screen.getByText('services')).toBeInTheDocument();
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
