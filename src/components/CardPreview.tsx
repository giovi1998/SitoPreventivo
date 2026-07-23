import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { deriveGridFromLayout } from '../utils/documentSchemas';
import type { BusinessCard, CardGrid, CardGridElement } from '../utils/documentSchemas';
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
import { GRID_PAD_REF, GRID_GAP_REF } from '../utils/card/gridConstants';
import { effectiveBackGridForRender } from '../utils/card/backLayout';
import { deriveHandle, deriveHostname } from '../utils/card/textDerivation';
import { renderDecorativePattern } from '../utils/decorations/patterns';
import PreviewWatermark from './PreviewWatermark';

interface CardPreviewProps {
  side: 'front' | 'back';
  card: BusinessCard;
  showGrid?: boolean;
  tier?: Tier;
  /** Elemento selezionato nel grid editor. Solo quando coincide con una
   * cella foto/QR attiva e `onPatchPlacement` è fornito è possibile
   * trascinare il contenuto per nudgarne la posizione. */
  selectedElement?: { side: 'front' | 'back'; key: string } | null;
  onPatchPlacement?: (key: string, patch: { x?: number; y?: number; scale?: number }) => void;
  /** Se true disabilita ogni interazione di drag (utile per export/snapshot). */
  readOnly?: boolean;
}

function CardPreview({ side, card, showGrid = false, tier = 'unlocked', selectedElement, onPatchPlacement, readOnly }: CardPreviewProps) {
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
        <FrontPreview
          card={card}
          qrPayload={qrPayload}
          gridOverlay={gridOverlay}
          gridDebug={gridDebug}
          showGrid={showGrid}
          selectedElement={selectedElement}
          onPatchPlacement={onPatchPlacement}
          readOnly={readOnly}
        />
        <PreviewWatermark tier={tier} />
      </div>
    );
  }
  return (
    <div className="card-preview-wrap" data-tier={tier} data-testid="card-preview-wrap-back">
      <BackPreview
        card={card}
        qrSvg={qrSvg}
        qrPayload={qrPayload}
        gridOverlay={gridOverlay}
        gridDebug={gridDebug}
        showGrid={showGrid}
        selectedElement={selectedElement}
        onPatchPlacement={onPatchPlacement}
        readOnly={readOnly}
      />
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

function useDraggablePlacement(
  side: 'front' | 'back',
  elementKey: string,
  element: CardGridElement | undefined,
  deps: {
    showGrid: boolean;
    /** CON-DF-002: la cella deve avere contenuto reale (foto/QR) per essere
     *  trascinabile — senza, il drag muoverebbe un placement invisibile. */
    hasContent: boolean;
    selectedElement: { side: 'front' | 'back'; key: string } | null | undefined;
    onPatchPlacement?: (key: string, patch: { x?: number; y?: number; scale?: number }) => void;
    readOnly?: boolean;
  }
) {
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; placement: { x: number; y: number; scale: number } } | null>(null);
  const cellRectRef = useRef<{ width: number; height: number } | null>(null);
  const lastDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const enabled = !!(
    deps.showGrid &&
    deps.hasContent &&
    !deps.readOnly &&
    deps.selectedElement?.side === side &&
    deps.selectedElement?.key === elementKey &&
    element &&
    deps.onPatchPlacement
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      cellRectRef.current = { width: rect.width, height: rect.height };
      const placement = element!.placement ?? element!.photoPlacement ?? { x: 0, y: 0, scale: 1 };
      startRef.current = { x: e.clientX, y: e.clientY, placement };
      lastDeltaRef.current = { x: 0, y: 0 };
      draggingRef.current = true;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // jsdom / old browsers: pointer capture is optional for this UX
      }
      target.classList.add('card-grid-cell--dragging');
    },
    [enabled, element]
  );

  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !startRef.current || !cellRectRef.current || !deps.onPatchPlacement) return;
      const dxPx = e.clientX - startRef.current.x;
      const dyPx = e.clientY - startRef.current.y;
      lastDeltaRef.current = { x: dxPx, y: dyPx };
      const { width, height } = cellRectRef.current;
      if (!width || !height) return;
      const dX = (dxPx / (width / 2));
      const dY = (dyPx / (height / 2));
      const clampedX = Math.min(1, Math.max(-1, startRef.current.placement.x + dX));
      const clampedY = Math.min(1, Math.max(-1, startRef.current.placement.y + dY));
      // GUD-DF-002: dead zone attorno al centro — micro-drag sotto soglia
      // snappano a 0 così ricentrare foto/QR non richiede precisione al pixel.
      const nextX = Math.abs(clampedX) < 0.05 ? 0 : clampedX;
      const nextY = Math.abs(clampedY) < 0.05 ? 0 : clampedY;
      const eps = 0.002;
      if (Math.abs(nextX - (element?.placement?.x ?? element?.photoPlacement?.x ?? 0)) > eps ||
          Math.abs(nextY - (element?.placement?.y ?? element?.photoPlacement?.y ?? 0)) > eps) {
        deps.onPatchPlacement!(elementKey, { x: nextX, y: nextY });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      startRef.current = null;
      cellRectRef.current = null;
      lastDeltaRef.current = { x: 0, y: 0 };
      try {
        const target = e.target as HTMLElement;
        target.classList.remove('card-grid-cell--dragging');
        target.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture may already be lost
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [enabled, element, elementKey, deps.onPatchPlacement]);

  return { onPointerDown, enabled, cursor: enabled ? 'grab' : undefined };
}

const FrontPreview = React.memo(function FrontPreview({
  card,
  qrPayload,
  gridOverlay,
  gridDebug,
  showGrid,
  selectedElement,
  onPatchPlacement,
  readOnly,
}: {
  card: BusinessCard;
  qrPayload: string;
  gridOverlay: React.ReactNode;
  gridDebug: React.ReactNode;
  showGrid: boolean;
  selectedElement?: { side: 'front' | 'back'; key: string } | null;
  onPatchPlacement?: (key: string, patch: { x?: number; y?: number; scale?: number }) => void;
  readOnly?: boolean;
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
  const photoDrag = useDraggablePlacement('front', 'photo', grid?.elements?.photo, {
    showGrid,
    hasContent: hasPhoto,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const logoDrag = useDraggablePlacement('front', 'logo', grid?.elements?.logo, {
    showGrid,
    hasContent: hasLogo,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const nameDrag = useDraggablePlacement('front', 'name', grid?.elements?.name, {
    showGrid,
    hasContent: !!card.front.name,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const titleDrag = useDraggablePlacement('front', 'title', grid?.elements?.title, {
    showGrid,
    hasContent: !!card.front.title,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const companyDrag = useDraggablePlacement('front', 'company', grid?.elements?.company, {
    showGrid,
    hasContent: !!card.front.company,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });

  const baseStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
    // v2.16: expose grid proportions as CSS variables so preview and export
    // share the same source of truth (see gridConstants.ts).
    ['--card-grid-pad' as any]: `${GRID_PAD_REF}px`,
    ['--card-grid-gap' as any]: `${GRID_GAP_REF}px`,
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
      {card.decorations?.pattern && (
        <svg
          className="card-decorative-pattern"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: renderDecorativePattern(card.decorations.pattern, 100, 100, {
              palette: card.decorations.palette || { primary: card.style.accentColor, secondary: card.style.textColor },
              opacity: card.decorations.opacity ?? 0.2,
            }),
          }}
        />
      )}
      {!card.decorations?.pattern && <span className="card-corner-accent" aria-hidden="true" />}
      {gridOverlay}
      {gridDebug}

      {card.style.borderStyle === 'accent-strip-left' && (
        <span className="card-accent-strip-left" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}
      {card.style.borderStyle === 'accent-strip-bottom' && (
        <span className="card-accent-strip-bottom" style={{ backgroundColor: card.style.accentColor }} aria-hidden="true" />
      )}

      {grid!.elements.photo && (
        <div
          className={`card-grid-cell ${photoDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
          data-testid="grid-el-photo"
          style={{ ...gridPlacement(grid!.elements.photo), cursor: photoDrag.cursor }}
          onPointerDown={photoDrag.onPointerDown}
          title={photoDrag.enabled ? 'Trascina per spostare la foto' : undefined}
        >
          {photoContent}
        </div>
      )}
      {grid!.elements.logo && card.front.logoUrl && (
        <div
          className={`card-grid-cell card-grid-cell--logo ${logoDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
          data-testid="grid-el-logo"
          style={{
            ...gridPlacement(grid!.elements.logo),
            cursor: logoDrag.cursor,
            // Parity with export (svgRenderer): logoBackground 'card' draws
            // a bg-tinted rect behind the dedicated logo cell.
            ...(card.front.logoBackground === 'card'
              ? { background: card.style.bgColor, borderRadius: '6px' }
              : {}),
          }}
          onPointerDown={logoDrag.onPointerDown}
          title={logoDrag.enabled ? 'Trascina per spostare il logo' : undefined}
        >
          <img className="card-logo grid" src={card.front.logoUrl} alt="Logo aziendale" />
        </div>
      )}
      {grid!.elements.name && card.front.name && (
        <div
          className={`card-grid-cell card-grid-cell--text ${nameDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
          data-testid="grid-el-name"
          style={{ ...gridPlacement(grid!.elements.name, 'column'), cursor: nameDrag.cursor }}
          onPointerDown={nameDrag.onPointerDown}
          title={nameDrag.enabled ? 'Trascina per spostare il nome' : undefined}
        >
          <div className="card-name">{card.front.name}</div>
        </div>
      )}
      {grid!.elements.title && card.front.title && (
        <div
          className={`card-grid-cell card-grid-cell--text ${titleDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
          data-testid="grid-el-title"
          style={{ ...gridPlacement(grid!.elements.title, 'column'), cursor: titleDrag.cursor }}
          onPointerDown={titleDrag.onPointerDown}
          title={titleDrag.enabled ? 'Trascina per spostare il ruolo' : undefined}
        >
          <div className="card-title" style={{ color: card.style.accentColor }}>{card.front.title}</div>
        </div>
      )}
      {grid!.elements.company && card.front.company && (
        <div
          className={`card-grid-cell card-grid-cell--text ${companyDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
          data-testid="grid-el-company"
          style={{ ...gridPlacement(grid!.elements.company, 'column'), cursor: companyDrag.cursor }}
          onPointerDown={companyDrag.onPointerDown}
          title={companyDrag.enabled ? 'Trascina per spostare l\'azienda' : undefined}
        >
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
  showGrid,
  selectedElement,
  onPatchPlacement,
  readOnly,
}: {
  card: BusinessCard;
  qrSvg: string;
  qrPayload: string;
  gridOverlay: React.ReactNode;
  gridDebug: React.ReactNode;
  showGrid: boolean;
  selectedElement?: { side: 'front' | 'back'; key: string } | null;
  onPatchPlacement?: (key: string, patch: { x?: number; y?: number; scale?: number }) => void;
  readOnly?: boolean;
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
  const baseGrid = needsBackGrid
    ? deriveGridFromLayout(
        {
          ...card,
          backGrid: rawGrid as CardGrid,
        },
        'back',
      )
    : rawGrid;
  // v2.10: same collapse as SVG export — empty services row is removed so
  // socials sit under contacts (hard WYSIWYG).
  const grid = baseGrid ? effectiveBackGridForRender(baseGrid, card) : baseGrid;
  const qrDrag = useDraggablePlacement('back', 'qr', grid?.elements?.qr, {
    showGrid,
    hasContent: !!qrPayload,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const contactsDrag = useDraggablePlacement('back', 'contacts', grid?.elements?.contacts, {
    showGrid,
    hasContent: hasContacts,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const servicesDrag = useDraggablePlacement('back', 'services', grid?.elements?.services, {
    showGrid,
    hasContent: (card.back.services ?? []).some((s) => s.trim().length > 0),
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const socialsDrag = useDraggablePlacement('back', 'socials', grid?.elements?.socials, {
    showGrid,
    hasContent: socials.length > 0,
    selectedElement,
    onPatchPlacement,
    readOnly,
  });
  const qrSizePx = qrSizePxFor(card);

  const rootStyle: React.CSSProperties = {
    backgroundColor: card.style.bgColor,
    color: card.style.textColor,
    fontFamily: card.style.fontFamily,
    ['--card-accent' as any]: card.style.accentColor,
    ['--card-font-scale' as any]: clampFontScale(card.style.fontScale ?? 1),
    ['--card-qr-size' as any]: `${qrSizePx}px`,
    // v2.16: grid proportion variables, shared with export.
    ['--card-grid-pad' as any]: `${GRID_PAD_REF}px`,
    ['--card-grid-gap' as any]: `${GRID_GAP_REF}px`,
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
      {card.decorations?.pattern && (
        <svg
          className="card-decorative-pattern card-decorative-pattern--back"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html: renderDecorativePattern(card.decorations.pattern, 100, 100, {
              palette: card.decorations.palette || { primary: card.style.accentColor, secondary: card.style.textColor },
              opacity: card.decorations.opacity ?? 0.2,
            }),
          }}
        />
      )}
      {!card.decorations?.pattern && <span className="card-corner-accent" aria-hidden="true" />}

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
          <div
            className={`card-grid-cell card-grid-cell--text card-grid-cell--contacts ${contactsDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
            data-testid="grid-el-contacts"
            style={{ ...gridPlacement(grid!.elements.contacts, 'column'), cursor: contactsDrag.cursor }}
            onPointerDown={contactsDrag.onPointerDown}
            title={contactsDrag.enabled ? 'Trascina per spostare i contatti' : undefined}
          >
            {contactsContent}
            {!grid!.elements.services && servicesContent}
            {!grid!.elements.socials && socialsContent}
          </div>
        )}
        {grid!.elements.services && servicesContent && (
          <div
            className={`card-grid-cell card-grid-cell--text card-grid-cell--services ${servicesDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
            data-testid="grid-el-services"
            style={(() => {
              const base = gridPlacement(grid!.elements.services, 'column');
              const withCursor = { ...base, cursor: servicesDrag.cursor };
              if (!base || socials.length > 0) return withCursor;
              // When socials are empty, let services expand into the unused socials row.
              const el = grid!.elements.services;
              const emptySocialsH = grid!.elements.socials?.h ?? 1;
              return { ...withCursor, gridRow: `${el.y + 1} / span ${el.h + emptySocialsH}` };
            })()}
            onPointerDown={servicesDrag.onPointerDown}
            title={servicesDrag.enabled ? 'Trascina per spostare i servizi' : undefined}
          >
            {servicesContent}
          </div>
        )}
        {grid!.elements.qr && (
          <div
            className={`card-grid-cell card-grid-cell--qr ${qrDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
            data-testid="grid-el-qr"
            style={{ ...gridPlacement(grid!.elements.qr), cursor: qrDrag.cursor }}
            onPointerDown={qrDrag.onPointerDown}
            title={qrDrag.enabled ? 'Trascina per spostare il QR' : undefined}
          >
            {qrContent}
          </div>
        )}
        {grid!.elements.socials && socialsContent && (
          <div
            className={`card-grid-cell card-grid-cell--text card-grid-cell--socials ${socialsDrag.enabled ? 'card-grid-cell--draggable' : ''}`}
            data-testid="grid-el-socials"
            style={{ ...gridPlacement(grid!.elements.socials, 'column'), cursor: socialsDrag.cursor }}
            onPointerDown={socialsDrag.onPointerDown}
            title={socialsDrag.enabled ? 'Trascina per spostare i social' : undefined}
          >
            {socialsContent}
          </div>
        )}
      </div>
    </div>
  );
});

export default React.memo(CardPreview);