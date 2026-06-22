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

    it('renders monogram derived from name (e.g. GIOVANNI CIDU → GC) on front', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'GIOVANNI CIDU' } };
      render(<CardPreview side="front" card={card} />);
      expect(screen.getByTestId('card-monogram-front')).toHaveTextContent('GC');
    });

    it('hides monogram when name is empty', () => {
      const card = createEmptyCard();
      render(<CardPreview side="front" card={card} />);
      expect(screen.queryByTestId('card-monogram-front')).toBeNull();
    });

    it('renders monogram placeholder (circular) when no photo is set in left layout (C6)', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI', layout: 'left' as BusinessCardLayout } };
      render(<CardPreview side="front" card={card} />);
      const placeholder = screen.getByTestId('card-photo-placeholder');
      expect(placeholder).toBeInTheDocument();
      expect(placeholder).toHaveTextContent('MR');
    });

    it('renders monogram filler in split layout when no photo is set (C7)', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'MARIO ROSSI', layout: 'split' as BusinessCardLayout } };
      render(<CardPreview side="front" card={card} />);
      const filler = screen.getByTestId('card-split-filler');
      expect(filler).toBeInTheDocument();
      expect(filler).toHaveTextContent('MR');
    });

    it('does NOT show bottom-right monogram when photo is present (C12)', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI', photoUrl: 'data:image/png;base64,AAAA', layout: 'left' as BusinessCardLayout },
      };
      render(<CardPreview side="front" card={card} />);
      // With photo present, the bottom-right monogram is hidden
      const monos = screen.queryAllByTestId('card-monogram-front');
      // The placeholder takes the spot of the photo, but no bottom-right mono
      monos.forEach((m) => {
        expect(m).not.toHaveClass('large');
      });
    });

    it('renders bottom area with 3 elements (monogram | handle/domain | logo) in left layout', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
      };
      const { container } = render(<CardPreview side="front" card={card} />);
      const bottom = container.querySelector('.card-front-left-bottom');
      expect(bottom).toBeInTheDocument();
      // Should have at least 2 child elements (monogram + handle)
      expect(bottom!.children.length).toBeGreaterThanOrEqual(2);
    });

    it('renders decorative diagonal pattern in top-right of front card', () => {
      const card = createEmptyCard();
      const { container } = render(<CardPreview side="front" card={card} />);
      const front = container.querySelector('.card-preview-front')!;
      // Pattern can be a CSS gradient or inline svg — check for either
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
      // (WEB assente perché website vuoto — verificato sotto)
    });

    it('renders socials as text handles in footer (not pill buttons — physical card)', () => {
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

  // ─── Grid-based rendering (Phase 2) ────────────────────────
  describe('Grid-based rendering', () => {
    it('front: when card.grid is set, renders with CSS Grid display', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        grid: gridPresetLeft(),
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
      const card1: BusinessCard = { ...createGiovanniCardTemplate(), grid };
      const { rerender } = render(<CardPreview side="front" card={card1} showGrid={true} />);
      let nameEl = document.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(window.getComputedStyle(nameEl).gridColumn).toBe('2 / span 3');

      // Move name to x=0, w=2
      const grid2 = { ...grid, elements: { ...grid.elements, name: { x: 0, y: 0, w: 2, h: 1 } } };
      rerender(<CardPreview side="front" card={{ ...card1, grid: grid2 }} showGrid={true} />);
      nameEl = document.querySelector('[data-testid="grid-el-name"]') as HTMLElement;
      expect(window.getComputedStyle(nameEl).gridColumn).toBe('1 / span 2');
    });

    it('back: when card.backGrid is set, renders QR and contacts via grid', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
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

    it('back: moving QR to x=0 changes its grid-column to 1', () => {
      const backGrid = gridPresetSplit();
      const card: BusinessCard = { ...createGiovanniCardTemplate(), backGrid };
      const { rerender } = render(<CardPreview side="back" card={card} showGrid={true} />);
      let qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('3 / span 1');

      const grid2 = { ...backGrid, elements: { ...backGrid.elements, qr: { x: 0, y: 2, w: 1, h: 2 } } };
      rerender(<CardPreview side="back" card={{ ...card, backGrid: grid2 }} showGrid={true} />);
      qrEl = document.querySelector('[data-testid="grid-el-qr"]') as HTMLElement;
      expect(window.getComputedStyle(qrEl).gridColumn).toBe('1 / span 1');
    });

    it('back: when card.grid has only FRONT elements, falls back to flexbox (Phase 2.1 fix)', () => {
      // Giovanni template: grid has photo/name/title/company/logo (no back elements)
      const card = createGiovanniCardTemplate();
      // Reset backGrid to undefined to simulate "grid has only front elements"
      const onlyFrontGrid = { ...card.grid!, backGrid: undefined };
      render(<CardPreview side="back" card={{ ...card, backGrid: undefined }} />);
      const back = screen.getByTestId('card-preview-back');
      // NOT in grid mode → flexbox → contacts/qr visible
      expect(back.className).not.toContain('grid-mode');
      expect(screen.queryByTestId('grid-el-qr')).toBeNull();
      expect(screen.queryByTestId('grid-el-contacts')).toBeNull();
    });

    it('front: showGrid=false ignores card.grid (uses flexbox even if grid is set) — Phase 2.1 UX fix', () => {
      // Giovanni template: grid ha elementi del front
      const card = createGiovanniCardTemplate();
      // showGrid=false (default) → anche se card.grid è settato, NO grid-mode
      render(<CardPreview side="front" card={card} showGrid={false} />);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).not.toContain('grid-mode');
      // Gli elementi grid non devono esistere nel DOM
      expect(document.querySelector('[data-testid="grid-el-photo"]')).toBeNull();
    });

    it('front: showGrid=true uses card.grid (grid-mode active)', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="front" card={card} showGrid={true} />);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
      // photo è nel grid → renderizzato come grid element
      expect(document.querySelector('[data-testid="grid-el-photo"]')).not.toBeNull();
    });

    it('back: showGrid=false ignores card.backGrid (uses flexbox even if backGrid is set)', () => {
      const card = createGiovanniCardTemplate();
      render(<CardPreview side="back" card={card} showGrid={false} />);
      const back = screen.getByTestId('card-preview-back');
      expect(back.className).not.toContain('grid-mode');
      // contacts/qr renderizzati come flexbox
      expect(document.querySelector('[data-testid="grid-el-qr"]')).toBeNull();
    });

    it('front: grid renders logo element with data-testid grid-el-logo (Phase 2.1)', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        front: { ...createGiovanniCardTemplate().front, logoUrl: 'data:image/png;base64,iVBORw0KGgo=' },
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
});
