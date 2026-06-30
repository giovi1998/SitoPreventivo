import React, { useMemo } from 'react';
import type { BusinessCard, BusinessCardSizePreset } from '../utils/documentSchemas';
import { hasGridElements, QR_SIZE_PX, FONT_SCALE_MIN, FONT_SCALE_MAX } from '../utils/documentSchemas';
import type { Tier } from '../utils/watermark';
import { resolveCardQrPayload } from '../utils/cardGenerator';
import { generateQrSvg } from '../utils/qrGenerator';
import PreviewWatermark from './PreviewWatermark';

function gridPlacement(el: { x: number; y: number; w: number; h: number }): React.CSSProperties {
  return {
    gridColumn: `${el.x + 1} / span ${el.w}`,
    gridRow: `${el.y + 1} / span ${el.h}`,
  };
}

interface CardPreviewProps {
  side: 'front' | 'back';
  card: BusinessCard;
  showGrid?: boolean;
  tier?: Tier;
}

const SIZE_CLASS: Record<BusinessCardSizePreset, string> = {
  'eu-85x55': 'size-eu-85x55',
  'us-89x51': 'size-us-89x51',
  'square-65x65': 'size-square-65x65',
};

function computeMonogram(name: string): string {
  if (!name) return '';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function deriveHostname(website: string): string {
  try {
    const url = new URL(website);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

function deriveHandle(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'linkedin.com' || host === 'github.com' || host === 'twitter.com' || host === 'x.com' || host === 'instagram.com') {
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      const handle = path.split('/').filter(Boolean).pop() || '';
      const prefix = host === 'twitter.com' || host === 'x.com' ? 'x' : host.split('.')[0];
      return handle ? `@${handle}` : prefix;
    }
    return u.pathname.replace(/^\/+|\/+$/g, '') || host;
  } catch {
    return url || '';
  }
}

// Phase 2.2 REQ-D04: clamp di sicurezza per il font scale. Lo schema Zod
// fa lo stesso clamp alla scrittura, ma qui difendiamo da card importate
// (JSON vecchi) con valori fuori range.
function clampFontScale(v: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 1;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v));
}

// UX fix: la griglia OFF nasconde overlay/controlli, ma NON deve perdere il
// layout salvato. Se l'utente o l'AI ha persistito `useGrid`, la preview resta
// in grid-mode anche quando `showGrid` è false. `showGrid` governa solo overlay.
function isGridModeFor(side: 'front' | 'back', card: BusinessCard, showGrid: boolean): boolean {
  const sideState = side === 'front' ? card.front : card.back;
  return !!sideState.useGrid && hasGridElements(side, card);
}

function CardPreview({ side, card, showGrid = false, tier = 'unlocked' }: CardPreviewProps) {
  const qrPayload = resolveCardQrPayload(card);

  // QR generato sincronamente (la libreria qrcode è sync, niente Promise
  // inutili). Così il QR è visibile al primo render — coerente con export.
  const qrSvg = useMemo(() => {
    if (side !== 'back' || !qrPayload) return '';
    const qrObj: any = {
      documentType: 'qrCode',
      id: 'card-preview',
      title: '',
      data: { type: 'url', payload: qrPayload },
      style: {
        errorCorrection: 'M',
        fgColor: card.style.textColor,
        bgColor: '#FFFFFF',
        size: 256,
        margin: 1,
        logoOverlay: null,
        dotStyle: 'square',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      return generateQrSvg(qrObj);
    } catch {
      return '';
    }
  }, [qrPayload, side, card.style.textColor]);

  // Grid overlay: 4×4 lines over the card (absolute positioned, pointer-events: none).
  // Visibile solo se il master switch è ON.
  const gridOverlay = showGrid ? (
    <svg className="card-grid-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="25" y1="0" x2="25" y2="100" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="75" y1="0" x2="75" y2="100" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="25" x2="100" y2="25" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="75" x2="100" y2="75" stroke="var(--card-accent)" strokeWidth="0.3" opacity="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
    </svg>
  ) : null;

  if (side === 'front') {
    return (
      <div className="card-preview-wrap" data-tier={tier} data-testid="card-preview-wrap-front">
        <FrontPreview card={card} gridOverlay={gridOverlay} showGrid={showGrid} />
        <PreviewWatermark tier={tier} />
      </div>
    );
  }
  return (
    <div className="card-preview-wrap" data-tier={tier} data-testid="card-preview-wrap-back">
      <BackPreview card={card} qrSvg={qrSvg} qrPayload={qrPayload} gridOverlay={gridOverlay} showGrid={showGrid} />
      <PreviewWatermark tier={tier} />
    </div>
  );
}

const FrontPreview = React.memo(function FrontPreview({ card, gridOverlay, showGrid }: { card: BusinessCard; gridOverlay: React.ReactNode; showGrid: boolean }) {
  const sizeClass = SIZE_CLASS[card.style.sizePreset];
  const layoutClass = `layout-${card.front.layout}`;
  const borderClass = `border-${card.style.borderStyle}`;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  const grid = card.grid;

  // Phase 2.2 REQ-E01: master switch governa grid-mode + overlay.
  // isGridMode = showGrid && hasGridElements (vedi helper in documentSchemas).
  const isGridMode = isGridModeFor('front', card, showGrid);

  const baseStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    // Phase 2.2 REQ-D04: scala font globale
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
  };

  const gridContainerStyle: React.CSSProperties = isGridMode
    ? {
        ...baseStyle,
        display: 'grid',
        gridTemplateColumns: `repeat(${grid!.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid!.rows}, 1fr)`,
      }
    : baseStyle;

  const photoContent = hasPhoto ? (
    <img className="card-photo" src={card.front.photoUrl!} alt="Foto del titolare" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
  ) : hasLogo ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(card.front.logoBackground === 'card' ? { background: card.style.bgColor, borderRadius: '6px' } : {}) }}>
      <img src={card.front.logoUrl!} alt="Logo aziendale" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
    </div>
  ) : null;

  return (
    <div
      data-testid="card-preview-front"
      className={`card-preview-side card-preview-front ${sizeClass} ${isGridMode ? 'grid-mode' : layoutClass} ${borderClass}`}
      style={gridContainerStyle}
      role="img"
      aria-label={`Bigliettino fronte: ${card.front.name || 'vuoto'}`}
    >
      <span className="card-corner-accent" aria-hidden="true" />
      {gridOverlay}

      {card.style.borderStyle === 'accent-strip-left' && (
        <span className="card-accent-strip-left" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}
      {card.style.borderStyle === 'accent-strip-bottom' && (
        <span className="card-accent-strip-bottom" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}

      {/* ─── Grid mode: each element positioned via CSS Grid ─── */}
      {isGridMode && (
        <>
          {grid!.elements.photo && (
            <div data-testid="grid-el-photo" style={gridPlacement(grid!.elements.photo)}>
              {photoContent}
            </div>
          )}
          {grid!.elements.logo && card.front.logoUrl && (
            <div data-testid="grid-el-logo" style={{ ...gridPlacement(grid!.elements.logo), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img className="card-logo grid" src={card.front.logoUrl} alt="Logo aziendale" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
            </div>
          )}
          {grid!.elements.name && card.front.name && (
            <div data-testid="grid-el-name" style={{ ...gridPlacement(grid!.elements.name), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card-name">{card.front.name}</div>
            </div>
          )}
          {grid!.elements.title && card.front.title && (
            <div data-testid="grid-el-title" style={{ ...gridPlacement(grid!.elements.title), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>
            </div>
          )}
          {grid!.elements.company && card.front.company && (
            <div data-testid="grid-el-company" style={{ ...gridPlacement(grid!.elements.company), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="card-company">{card.front.company}</div>
            </div>
          )}
        </>
      )}

      {/* ─── Flexbox mode (no grid) ─── */}
      {!isGridMode && card.front.layout === 'centered' && (
        <div className="card-front-centered">
          {hasPhoto ? (
            <img className="card-photo centered" src={card.front.photoUrl!} alt="Foto del titolare" />
          ) : hasLogo ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(card.front.logoBackground === 'card' ? { background: card.style.bgColor, borderRadius: '6px' } : {}) }}>
              <img src={card.front.logoUrl!} alt="Logo aziendale" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
            </div>
          ) : null}
          <div className="card-front-text">
            {card.front.name && <div className="card-name">{card.front.name}</div>}
            {card.front.title && <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>}
            {card.front.company && <div className="card-company">{card.front.company}</div>}
          </div>
          {hasLogo && hasPhoto && (
            <div className="card-front-footer">
              <img className="card-logo centered" src={card.front.logoUrl!} alt="Logo aziendale" />
            </div>
          )}
        </div>
      )}

      {!isGridMode && card.front.layout === 'left' && (
        <div className="card-front-left">
          <div className="card-front-left-top">
            {hasPhoto ? (
              <img className="card-photo left" src={card.front.photoUrl!} alt="Foto del titolare" />
            ) : hasLogo ? (
              <div style={{ width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(card.front.logoBackground === 'card' ? { background: card.style.bgColor, borderRadius: '6px' } : {}) }}>
                <img src={card.front.logoUrl!} alt="Logo aziendale" style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
              </div>
            ) : null}
            <div className="card-front-text">
              {card.front.name && <div className="card-name">{card.front.name}</div>}
              {card.front.title && <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>}
              {card.front.company && <div className="card-company">{card.front.company}</div>}
            </div>
          </div>
          <span className="card-accent-divider" data-testid="card-accent-divider" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
          <div className="card-front-left-bottom">
            {card.back.website && (() => {
              try {
                const host = new URL(card.back.website).hostname.replace(/^www\./, '');
                return <span className="card-handle-stamp" style={{ color: card.style.textColor }}>{host}</span>;
              } catch {
                return null;
              }
            })()}
            {hasLogo && hasPhoto && <img className="card-logo left" src={card.front.logoUrl!} alt="Logo aziendale" />}
          </div>
        </div>
      )}

      {!isGridMode && card.front.layout === 'split' && (
        <div className="card-front-split">
          <div className="card-split-left">
            {hasPhoto ? (
              <img className="card-photo split" src={card.front.photoUrl!} alt="Foto del titolare" />
            ) : hasLogo ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(card.front.logoBackground === 'card' ? { background: card.style.bgColor } : {}) }}>
                <img src={card.front.logoUrl!} alt="Logo aziendale" style={{ maxWidth: '70%', maxHeight: '70%', objectFit: 'contain' }} />
              </div>
            ) : null}
          </div>
          <div className="card-split-right">
            <div className="card-front-text">
              {card.front.name && <div className="card-name">{card.front.name}</div>}
              {card.front.title && <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>}
              {card.front.company && <div className="card-company">{card.front.company}</div>}
            </div>
            <div className="card-split-footer">
              {hasLogo && hasPhoto && <img className="card-logo split" src={card.front.logoUrl!} alt="Logo aziendale" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const BackPreview = React.memo(function BackPreview({ card, qrSvg, qrPayload, gridOverlay, showGrid }: { card: BusinessCard; qrSvg: string; qrPayload: string; gridOverlay: React.ReactNode; showGrid: boolean }) {
  const sizeClass = SIZE_CLASS[card.style.sizePreset];
  const borderClass = `border-${card.style.borderStyle}`;
  const socials = card.back.socials.filter((s) => s.platform && s.url);
  const hostname = card.back.website ? deriveHostname(card.back.website) : '';
  const headerWord = hostname || card.front.company || '';
  const grid = card.backGrid ?? card.grid;

  // Phase 2.2 REQ-E01: master switch governa grid-mode.
  const isGridMode = isGridModeFor('back', card, showGrid);

  // Phase 2.2 REQ-E02: dimensione QR in flexbox-mode. Default 'medium' (120px).
  // In grid-mode la dimensione viene dalla cella (100% del contenitore, vedi CSS).
  const qrSizePx = QR_SIZE_PX[card.back.qrSize] ?? QR_SIZE_PX.medium;

  const baseStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    // Phase 2.2 REQ-D04: scala font globale
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
    // Phase 2.2 REQ-E02: dimensione QR in flexbox-mode. In grid-mode il
    // CSS sovrascrive a 100% del contenitore.
    ['--card-qr-size' as any]: `${qrSizePx}px`,
  };

  const gridContainerStyle: React.CSSProperties = isGridMode
    ? {
        ...baseStyle,
        display: 'grid',
        gridTemplateColumns: `repeat(${grid!.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid!.rows}, 1fr)`,
      }
    : baseStyle;

  const contactsContent = (
    <>
      {card.back.phone && <div className="card-back-line"><span className="card-back-key">Telefono</span><span className="card-back-val">{card.back.phone}</span></div>}
      {card.back.email && <div className="card-back-line"><span className="card-back-key">Email</span><span className="card-back-val" data-testid="card-back-email-val">{card.back.email}</span></div>}
      {/* Phase 2.1: WEB row omessa se QR presente (ridondante — il QR codifica già l'URL) */}
      {card.back.website && !qrPayload && (
        <div className="card-back-line">
          <span className="card-back-key">Web</span>
          <span className="card-back-val" style={{ color: card.style.accentColor }}>{card.back.website}</span>
        </div>
      )}
      {card.back.address && <div className="card-back-line"><span className="card-back-key">Indirizzo</span><span className="card-back-val">{card.back.address}</span></div>}
      {card.back.vatNumber && <div className="card-back-line"><span className="card-back-key">P.IVA</span><span className="card-back-val">{card.back.vatNumber}</span></div>}
    </>
  );

  const socialsContent = socials.length > 0 ? (
    <div className="card-back-socials" data-testid="card-back-socials">
      {socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} · ${value}`;
        })
        .join(' · ')}
    </div>
  ) : null;

  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  // Phase 2.2 REQ-F02/F03: block label editabile + auto-shrink classe
  // condizionale quando i singoli servizi sono lunghi (>= 40 char).
  const servicesLabelText = (card.back.servicesLabel ?? '').trim();
  const hasLongService = services.some((s) => s.length >= 40);
  const servicesContent = services.length > 0 ? (
    <>
      {servicesLabelText && (
        <div className="card-back-services-label" data-testid="card-back-services-label">
          {servicesLabelText}
        </div>
      )}
      <ul
        className={`card-back-services ${hasLongService ? 'card-back-services--long' : ''}`}
        data-testid="card-back-services"
      >
        {services.map((s, idx) => (
          <li key={idx}>{s}</li>
        ))}
      </ul>
    </>
  ) : null;

  const qrContent = qrSvg ? (
    <div className="card-back-qr">
      <div className="card-back-qr-frame" style={{ borderColor: card.style.accentColor }}>
        <div className="card-back-qr-svg" role="img" aria-label={`QR code: ${qrPayload}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
      {card.back.qrLabel && <div className="card-back-qr-label">{card.back.qrLabel}</div>}
      {hostname && (
        <div className="card-back-qr-wordmark" style={{ color: card.style.accentColor }}>
          {hostname}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      data-testid="card-preview-back"
      className={`card-preview-side card-preview-back ${sizeClass} ${isGridMode ? 'grid-mode' : ''} ${borderClass}`}
      style={gridContainerStyle}
      role="img"
      aria-label={`Bigliettino retro: ${card.front.name || 'vuoto'}`}
    >
      <span className="card-corner-accent" aria-hidden="true" />
      {gridOverlay}

      {card.style.borderStyle === 'accent-strip-left' && (
        <span className="card-accent-strip-left" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}
      {card.style.borderStyle === 'accent-strip-bottom' && (
        <span className="card-accent-strip-bottom" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}

      {/* ─── Grid mode ─── */}
      {isGridMode ? (
        <>
          {grid!.elements.contacts && (
            <div data-testid="grid-el-contacts" style={{ ...gridPlacement(grid!.elements.contacts), padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', minWidth: 0 }}>
              {contactsContent}
              {servicesContent}
              {/* fix: i social vanno SOLO nella cella `socials` se esiste,
                  altrimenti (fallback) restano coi contatti. Senza questo
                  controllo i social comparivano DUE volte (qui + cella socials). */}
              {!grid!.elements.socials && socialsContent}
            </div>
          )}
          {grid!.elements.qr && (
            <div data-testid="grid-el-qr" style={{ ...gridPlacement(grid!.elements.qr), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 0 }}>
              {qrContent}
            </div>
          )}
          {grid!.elements.socials && socialsContent && (
            <div data-testid="grid-el-socials" style={{ ...gridPlacement(grid!.elements.socials), padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
              {socialsContent}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ─── Flexbox mode (original) ─── */}
          {headerWord && (
            <div className="card-back-header" data-testid="card-back-header">
              <span className="card-back-eyebrow" style={{ color: card.style.accentColor }}>Contatti</span>
              <span className="card-back-wordmark" data-testid="card-back-wordmark" style={{ color: card.style.accentColor }}>
                {headerWord}
              </span>
            </div>
          )}

          <div className="card-back-body">
            <div className="card-back-contacts">
              {contactsContent}
              {servicesContent}
              {socialsContent}
            </div>
            {qrContent}
          </div>
        </>
      )}
    </div>
  );
});

export default React.memo(CardPreview);
