import React, { useMemo } from 'react';
import { deriveGridFromLayout } from '../utils/documentSchemas';
import type { BusinessCard, CardGrid } from '../utils/documentSchemas';
import type { Tier } from '../utils/watermark';
import { resolveCardQrPayload } from '../utils/cardGenerator';
import { generateQrSvg } from '../utils/qrGenerator';
import {
  SIZE_CLASS,
  clampFontScale,
  gridPlacement,
  isGridModeFor,
  qrSizePxFor,
  sideGrid,
} from '../utils/card/previewHelpers';
import { deriveHandle, deriveHostname } from '../utils/card/textDerivation';
import PreviewWatermark from './PreviewWatermark';

interface CardPreviewProps {
  side: 'front' | 'back';
  card: BusinessCard;
  showGrid?: boolean;
  tier?: Tier;
}

function CardPreview({ side, card, showGrid = false, tier = 'unlocked' }: CardPreviewProps) {
  const qrPayload = resolveCardQrPayload(card);

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

  const grid = sideGrid(side, card);

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

  const nonEmptyGridKeys = useMemo(() => {
    const set = new Set<string>();
    if (side === 'front') {
      if (card.front.photoUrl) set.add('photo');
      if (card.front.logoUrl) set.add('logo');
      if (card.front.name?.trim()) set.add('name');
      if (card.front.title?.trim()) set.add('title');
      if (card.front.company?.trim()) set.add('company');
    } else {
      const hasContacts =
        card.back.phone?.trim() ||
        card.back.email?.trim() ||
        card.back.website?.trim() ||
        card.back.address?.trim() ||
        card.back.vatNumber?.trim();
      if (hasContacts) set.add('contacts');
      if (card.back.services?.some((s) => s.trim())) set.add('services');
      if (card.back.socials?.some((s) => s.platform && s.url)) set.add('socials');
      if (qrPayload) set.add('qr');
    }
    return set;
  }, [card, side, qrPayload]);

  const gridDebug = showGrid && grid ? (
    <div
      className="card-grid-debug"
      data-testid="card-grid-debug"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {Object.entries(grid.elements).map(([key, el]) => {
        if (!el) return null;
        if (!nonEmptyGridKeys.has(key)) return null;
        const color = DEBUG_COLORS[key] || '#94a3b8';
        return (
          <div
            key={key}
            style={{
              ...gridPlacement(el),
              border: `2px solid ${color}`,
              background: `${color}14`,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              padding: '2px 4px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {key}
            </span>
          </div>
        );
      })}
    </div>
  ) : null;

  if (side === 'front') {
    return (
      <div className="card-preview-wrap" data-tier={tier} data-testid="card-preview-wrap-front">
        <FrontPreview card={card} qrPayload={qrPayload} gridOverlay={gridOverlay} gridDebug={gridDebug} />
        <PreviewWatermark tier={tier} />
      </div>
    );
  }
  return (
    <div className="card-preview-wrap" data-tier={tier} data-testid="card-preview-wrap-back">
      <BackPreview card={card} qrSvg={qrSvg} qrPayload={qrPayload} gridOverlay={gridOverlay} gridDebug={gridDebug} />
      <PreviewWatermark tier={tier} />
    </div>
  );
}

const DEBUG_COLORS: Record<string, string> = {
  photo: '#ef4444',
  name: '#3b82f6',
  title: '#10b981',
  company: '#f59e0b',
  logo: '#8b5cf6',
  contacts: '#6366f1',
  qr: '#14b8a6',
  socials: '#f43f5e',
  services: '#a855f7',
};

const FrontPreview = React.memo(function FrontPreview({
  card,
  qrPayload,
  gridOverlay,
  gridDebug,
}: {
  card: BusinessCard;
  qrPayload: string;
  gridOverlay: React.ReactNode;
  gridDebug: React.ReactNode;
}) {
  const sizeClass = SIZE_CLASS[card.style.sizePreset];
  const borderClass = `border-${card.style.borderStyle}`;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  // v2.8: when front.useGrid is false, derive fresh from layout so
  // stale grids (missing photo element, wrong positions) don't hide
  // content. Same fix applied to BackPreview.
  const rawGrid = isGridModeFor('front', card) ? card.grid : undefined;
  const grid = rawGrid ?? deriveGridFromLayout(card, 'front');

  const baseStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
    display: 'grid',
    gridTemplateColumns: `repeat(${grid!.cols}, 1fr)`,
    gridTemplateRows: `repeat(${grid!.rows}, 1fr)`,
    position: 'relative',
  };

  const coverImageStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Readability wash: two stacked layers that match the SVG renderer's
  // wash (see svgRenderer.ts `1a.`). They keep the cover visible at the
  // top (where the photo sits) but calm the lower half so the name/title
  // are readable even when the AI image is busy.
  // v2.4 fix: the wash is much stronger (60% flat + 80% gradient bottom)
  // because the AI cover can be very saturated and the user content
  // (text, logo, photo) must always win visually over the cover.
  const coverWashFlatStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: card.style.bgColor,
    opacity: 0.6,
    zIndex: 0,
    pointerEvents: 'none',
  };
  const coverWashGradStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to bottom, ${card.style.bgColor}00 0%, ${card.style.bgColor}40 55%, ${card.style.bgColor}cc 100%)`,
    zIndex: 0,
    pointerEvents: 'none',
  };

  const isPhotoCircle = card.front.layout === 'photo-circle';
  // Show the logo as a fallback inside the photo cell ONLY when the
  // grid does not also have a separate `logo` element. Otherwise the
  // logo would be rendered twice (once in the photo cell fallback,
  // once in the dedicated logo cell).
  const logoAlreadyInGrid = !!grid?.elements?.logo;
  const photoContent = hasPhoto ? (
    <img
      className="card-photo"
      src={card.front.photoUrl!}
      alt="Foto del titolare"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: isPhotoCircle ? '50%' : '4px',
      }}
    />
  ) : (hasLogo && !logoAlreadyInGrid) ? (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(card.front.logoBackground === 'card' ? { background: card.style.bgColor, borderRadius: '6px' } : {}) }}>
      <img src={card.front.logoUrl!} alt="Logo aziendale" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  ) : null;

  return (
    <div
      data-testid="card-preview-front"
      className={`card-preview-side card-preview-front ${sizeClass} grid-mode ${borderClass}`}
      style={baseStyle}
      role="img"
      aria-label={`Bigliettino fronte: ${card.front.name || 'vuoto'}`}
    >
      {card.front.coverImageUrl && <img src={card.front.coverImageUrl} alt="" style={coverImageStyle} />}
      {card.front.coverImageUrl && <div style={coverWashFlatStyle} aria-hidden="true" />}
      {card.front.coverImageUrl && <div style={coverWashGradStyle} aria-hidden="true" />}
      <span className="card-corner-accent" aria-hidden="true" />
      {gridOverlay}
      {gridDebug}

      {card.style.borderStyle === 'accent-strip-left' && (
        <span className="card-accent-strip-left" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}
      {card.style.borderStyle === 'accent-strip-bottom' && (
        <span className="card-accent-strip-bottom" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}

      {grid!.elements.photo && (
        <div className="card-grid-cell" data-testid="grid-el-photo" style={gridPlacement(grid!.elements.photo)}>
          {photoContent}
        </div>
      )}
      {grid!.elements.logo && card.front.logoUrl && (
        <div className="card-grid-cell card-grid-cell--logo" data-testid="grid-el-logo" style={gridPlacement(grid!.elements.logo)}>
          <img className="card-logo grid" src={card.front.logoUrl} alt="Logo aziendale" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
      {grid!.elements.name && card.front.name && (
        <div className="card-grid-cell card-grid-cell--text" data-testid="grid-el-name" style={gridPlacement(grid!.elements.name)}>
          <div className="card-name">{card.front.name}</div>
        </div>
      )}
      {grid!.elements.title && card.front.title && (
        <div className="card-grid-cell card-grid-cell--text" data-testid="grid-el-title" style={gridPlacement(grid!.elements.title)}>
          <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>
        </div>
      )}
      {grid!.elements.company && card.front.company && (
        <div className="card-grid-cell card-grid-cell--text" data-testid="grid-el-company" style={gridPlacement(grid!.elements.company)}>
          <div className="card-company">{card.front.company}</div>
        </div>
      )}
    </div>
  );
});

const BackPreview = React.memo(function BackPreview({
  card,
  qrSvg,
  qrPayload,
  gridOverlay,
  gridDebug,
}: {
  card: BusinessCard;
  qrSvg: string;
  qrPayload: string;
  gridOverlay: React.ReactNode;
  gridDebug: React.ReactNode;
}) {
  const sizeClass = SIZE_CLASS[card.style.sizePreset];
  const borderClass = `border-${card.style.borderStyle}`;
  const socials = card.back.socials.filter((s) => s.platform && s.url);
  const hostname = card.back.website ? deriveHostname(card) : '';
  const headerWord = hostname || card.front.company || '';
  // v2.5: track if at least one contact exists so we can still show
  // the "CONTATTI" eyebrow even when there is no wordmark/company.
  const hasContacts = !!(
    card.back.phone?.trim() ||
    card.back.email?.trim() ||
    card.back.website?.trim() ||
    card.back.address?.trim() ||
    card.back.vatNumber?.trim()
  );
  // v2.7.1: Always derive a back grid with contacts/services/socials/qr
  // if the persisted backGrid is missing or doesn't contain a contacts
  // element. This prevents the preview from going blank when the card is
  // opened in flexbox mode (backGrid undefined) or when the grid was
  // filtered down to zero back elements.
  // v2.8: when back.useGrid is false (flexbox mode), ignore the persisted
  // backGrid entirely — it may be stale from an older version with
  // contacts h:1 / alignV bottom that hides contacts. Derive fresh from
  // the default preset so the preview always shows contacts correctly.
  const rawGrid = isGridModeFor('back', card) ? (card.backGrid ?? card.grid) : null;
  const needsBackGrid =
    !rawGrid ||
    !rawGrid.elements.contacts ||
    !Object.keys(rawGrid.elements).some((k) =>
      ['contacts', 'services', 'socials', 'qr'].includes(k),
    );
  const grid = needsBackGrid
    ? deriveGridFromLayout(
        {
          ...card,
          backGrid: rawGrid as CardGrid,
        },
        'back',
      )
    : rawGrid;

  const qrSizePx = qrSizePxFor(card);

  const rootStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
    ['--card-qr-size' as any]: `${qrSizePx}px`,
    position: 'relative',
  };

  const coverImageStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
    pointerEvents: 'none',
  };

  // Readability wash (matches svgRenderer.ts back layer).
  const backCoverWashFlatStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: card.style.bgColor,
    opacity: 0.35,
    zIndex: 0,
    pointerEvents: 'none',
  };
  const backCoverWashGradStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: `linear-gradient(to bottom, ${card.style.bgColor}00 0%, ${card.style.bgColor}73 100%)`,
    zIndex: 0,
    pointerEvents: 'none',
  };

  const bodyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${grid!.cols}, 1fr)`,
    gridTemplateRows: `repeat(${grid!.rows}, 1fr)`,
    flex: 1,
    minHeight: 0,
  };

  const contactsContent = (
    <>
      {card.back.phone && <div className="card-back-line"><span className="card-back-key">Telefono</span><span className="card-back-val">{card.back.phone}</span></div>}
      {card.back.email && <div className="card-back-line"><span className="card-back-key">Email</span><span className="card-back-val" data-testid="card-back-email-val">{card.back.email}</span></div>}
      {card.back.website && !qrPayload && (
        <div className="card-back-line">
          <span className="card-back-key">Web</span>
          <span className="card-back-val" data-testid="card-back-website-val" style={{ color: card.style.accentColor }}>{card.back.website}</span>
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
          return `${s.platform} ${value}`;
        })
        .join('   ')}
    </div>
  ) : null;

  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
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
    </div>
  ) : null;

  return (
    <div
      data-testid="card-preview-back"
      className={`card-preview-side card-preview-back ${sizeClass} ${borderClass}`}
      style={rootStyle}
      role="img"
      aria-label={`Bigliettino retro: ${card.front.name || 'vuoto'}`}
    >
      {card.back.coverImageUrl && <img src={card.back.coverImageUrl} alt="" style={coverImageStyle} />}
      {card.back.coverImageUrl && <div style={backCoverWashFlatStyle} aria-hidden="true" />}
      {card.back.coverImageUrl && <div style={backCoverWashGradStyle} aria-hidden="true" />}
      <span className="card-corner-accent" aria-hidden="true" />

      {card.style.borderStyle === 'accent-strip-left' && (
        <span className="card-accent-strip-left" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}
      {card.style.borderStyle === 'accent-strip-bottom' && (
        <span className="card-accent-strip-bottom" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}

      {(hasContacts || headerWord) && (
        <div className="card-back-header" data-testid="card-back-header">
          <span className="card-back-eyebrow" style={{ color: card.style.accentColor }}>Contatti</span>
          {headerWord && (
            <span className="card-back-wordmark" data-testid="card-back-wordmark" style={{ color: card.style.accentColor }}>
              {headerWord}
            </span>
          )}
        </div>
      )}

      <div className="card-back-body-grid" style={bodyGridStyle}>
        {gridOverlay}
        {gridDebug}

        {grid!.elements.contacts && (
          <div className="card-grid-cell card-grid-cell--text card-grid-cell--contacts" data-testid="grid-el-contacts" style={gridPlacement(grid!.elements.contacts)}>
            {contactsContent}
            {!grid!.elements.services && servicesContent}
            {!grid!.elements.socials && socialsContent}
          </div>
        )}
        {grid!.elements.services && servicesContent && (
          <div
            className="card-grid-cell card-grid-cell--text card-grid-cell--services"
            data-testid="grid-el-services"
            style={(() => {
              const base = gridPlacement(grid!.elements.services);
              if (!base || socials.length > 0) return base;
              // When socials are empty, let services expand into the unused socials row.
              const el = grid!.elements.services;
              const emptySocialsH = grid!.elements.socials?.h ?? 1;
              return { ...base, gridRow: `${el.y + 1} / span ${el.h + emptySocialsH}` };
            })()}
          >
            {servicesContent}
          </div>
        )}
        {grid!.elements.qr && (
          <div className="card-grid-cell card-grid-cell--qr" data-testid="grid-el-qr" style={gridPlacement(grid!.elements.qr)}>
            {qrContent}
          </div>
        )}
        {grid!.elements.socials && socialsContent && (
          <div className="card-grid-cell card-grid-cell--text card-grid-cell--socials" data-testid="grid-el-socials" style={gridPlacement(grid!.elements.socials)}>
            {socialsContent}
          </div>
        )}
      </div>
    </div>
  );
});

export default React.memo(CardPreview);