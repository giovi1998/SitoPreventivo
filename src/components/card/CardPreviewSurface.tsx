import React, { useEffect, useRef, useState } from 'react';
import CardPreview from '../CardPreview';
import CardPreviewZoomControls from '../CardPreviewZoomControls';
import type { BusinessCard } from '../../utils/documentSchemas';
import type { Tier } from '../../utils/watermark';

// Larghezza logica di riferimento della preview (= max-width di
// .card-preview-side in cardPreviewSide.css). La card viene SEMPRE
// renderizzata a questa larghezza e poi scalata intera (auto-fit), così
// le proporzioni font/layout restano identiche tra mobile e desktop.
export const CARD_PREVIEW_REF_WIDTH = 640;

// Phase 2.2 refactor: superficie di anteprima condivisa (header con zoom +
// toggle griglia + le due preview fronte/retro). Prima questo blocco era
// duplicato nella tab mobile "Anteprima" e nella colonna desktop.

export interface CardPreviewZoomApi {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  canZoomIn: () => boolean;
  canZoomOut: () => boolean;
}

export interface CardPreviewSurfaceProps {
  card: BusinessCard;
  tier: Tier;
  showGrid: boolean;
  onToggleGrid: () => void;
  zoom: CardPreviewZoomApi;
  /** Mostrato in cima (es. "Anteprima"). Default nessun titolo. */
  heading?: string;
  /** Elemento grid selezionato (front/back). Se la cella supporta placement
   * (foto/QR) e onPatchPlacement è fornito, la preview abilita il drag. */
  selectedElement?: { side: 'front' | 'back'; key: string } | null;
  onPatchPlacement?: (key: string, patch: { x?: number; y?: number; scale?: number }) => void;
  /** Modalità picker elemento (toggle nella toolbar preview). */
  pickerMode?: boolean;
  onTogglePicker?: () => void;
}

export default function CardPreviewSurface({
  card,
  tier,
  showGrid,
  onToggleGrid,
  zoom,
  heading,
  selectedElement,
  onPatchPlacement,
  pickerMode = false,
  onTogglePicker,
}: CardPreviewSurfaceProps) {
  // Phase 2.2 REQ-C01: scaling che riserva spazio (no overflow). Usa `zoom`
  // CSS dove supportato, fallback a transform scale.
  // Auto-fit responsive: la card è sempre renderizzata a REF_WIDTH px logici
  // e scalata intera in base alla larghezza reale del container
  // (ResizeObserver). Proporzioni identiche mobile/desktop; i workaround
  // preview-only (zoom 0.7 forzato, media query ≤900px sui font) sono stati
  // rimossi.
  const fitWrapRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState<number>(CARD_PREVIEW_REF_WIDTH);

  useEffect(() => {
    const el = fitWrapRef.current;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setContainerW(w);
    };
    measure(el.clientWidth);
    // jsdom (test) può non avere ResizeObserver: resta il default REF_WIDTH.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === 'number') measure(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = Math.min(1, containerW / CARD_PREVIEW_REF_WIDTH);
  const effectiveZoom = fitScale * zoom.zoom;
  const supportsCssZoom =
    typeof CSS !== 'undefined' && 'zoom' in (document?.documentElement?.style ?? {});

  // Width fissa in px: la card è sempre larga REF_WIDTH e viene scalata.
  // Con CSS `zoom` lo spazio layout è riservato automaticamente (nessuna
  // compensazione width necessaria). Nel fallback transform (browser senza
  // CSS zoom, es. Firefox <126) lo spazio occupato NON è compensato: il
  // wrapper con overflow:hidden evita scroll orizzontale, ma resta spazio
  // verticale extra sotto la preview — trade-off accettato per semplicità.
  const previewsStyle: React.CSSProperties = {
    width: CARD_PREVIEW_REF_WIDTH,
    maxWidth: 'none',
    ...(supportsCssZoom
      ? ({ zoom: effectiveZoom } as React.CSSProperties)
      : { transform: `scale(${effectiveZoom})`, transformOrigin: 'top center' }),
  };

  return (
    <>
      <div className="card-editor-preview-header">
        {heading ? <h2>{heading}</h2> : <span />}
        <div className="card-editor-preview-toolbar">
          <CardPreviewZoomControls
            zoom={zoom.zoom}
            canZoomIn={zoom.canZoomIn()}
            canZoomOut={zoom.canZoomOut()}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            onReset={zoom.reset}
          />
          <button
            type="button"
            className={`card-grid-toggle ${showGrid ? 'active' : ''}`}
            onClick={onToggleGrid}
            title={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
            aria-label={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
            aria-pressed={showGrid}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span>{showGrid ? 'Griglia ON' : 'Griglia OFF'}</span>
          </button>
          {onTogglePicker && (
            <button
              type="button"
              className={`card-grid-toggle ${pickerMode ? 'active' : ''}`}
              onClick={onTogglePicker}
              title={pickerMode ? 'Esci dalla selezione (Esc)' : 'Seleziona un elemento da modificare con AI'}
              aria-label={pickerMode ? 'Esci dalla selezione' : 'Seleziona elemento'}
              aria-pressed={pickerMode}
            >
              🎯
              <span>{pickerMode ? 'Seleziona…' : 'Elemento'}</span>
            </button>
          )}
        </div>
      </div>
      <div
        ref={fitWrapRef}
        style={supportsCssZoom ? undefined : { overflow: 'hidden' }}
        data-testid="card-preview-fit"
      >
        <div className="card-previews" style={previewsStyle} data-card-preview="true">
          <div className="card-preview-wrap">
            <h3>Fronte</h3>
            <CardPreview
              side="front"
              card={card}
              showGrid={showGrid}
              tier={tier}
              selectedElement={selectedElement}
              onPatchPlacement={onPatchPlacement}
            />
          </div>
          <div className="card-preview-wrap">
            <h3>Retro</h3>
            <CardPreview
              side="back"
              card={card}
              showGrid={showGrid}
              tier={tier}
              selectedElement={selectedElement}
              onPatchPlacement={onPatchPlacement}
            />
          </div>
        </div>
      </div>
    </>
  );
}
