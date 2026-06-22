interface CardPreviewZoomControlsProps {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export default function CardPreviewZoomControls({
  zoom,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: CardPreviewZoomControlsProps) {
  const percent = Math.round(zoom * 100);
  return (
    <div className="card-preview-zoom-controls" role="group" aria-label="Controlli zoom anteprima">
      <button
        type="button"
        className="card-preview-zoom-btn"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Riduci zoom"
        title="Riduci zoom"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        className="card-preview-zoom-label"
        onClick={onReset}
        aria-label={`Reset zoom (${percent}%)`}
        title="Reset zoom"
      >
        {percent}%
      </button>
      <button
        type="button"
        className="card-preview-zoom-btn"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Aumenta zoom"
        title="Aumenta zoom"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
