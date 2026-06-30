import React from 'react';
import CardPreview from '../CardPreview';
import CardPreviewZoomControls from '../CardPreviewZoomControls';
import type { BusinessCard } from '../../utils/documentSchemas';
import type { Tier } from '../../utils/watermark';

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
}

export default function CardPreviewSurface({
  card,
  tier,
  showGrid,
  onToggleGrid,
  zoom,
  heading,
}: CardPreviewSurfaceProps) {
  // Phase 2.2 REQ-C01: scaling che riserva spazio (no overflow). Usa `zoom`
  // CSS dove supportato, fallback a transform scale.
  const previewsStyle: React.CSSProperties = {
    ...(typeof CSS !== 'undefined' && 'zoom' in (document?.documentElement?.style ?? {})
      ? ({ zoom: zoom.zoom } as React.CSSProperties)
      : { transform: `scale(${zoom.zoom})`, transformOrigin: 'top center' }),
    width: `${zoom.zoom * 100}%`,
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
        </div>
      </div>
      <div className="card-previews" style={previewsStyle}>
        <div className="card-preview-wrap">
          <h3>Fronte</h3>
          <CardPreview side="front" card={card} showGrid={showGrid} tier={tier} />
        </div>
        <div className="card-preview-wrap">
          <h3>Retro</h3>
          <CardPreview side="back" card={card} showGrid={showGrid} tier={tier} />
        </div>
      </div>
    </>
  );
}
