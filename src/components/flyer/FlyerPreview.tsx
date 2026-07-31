import React, { useEffect, useRef, useState } from 'react';
import { getFlyerDimensions } from '../../utils/documentSchemas';
import { buildFlyerSvg } from '../../utils/flyerGenerator';
import type { Flyer } from '../../utils/documentSchemas';

interface FlyerPreviewProps {
  flyer: Flyer;
  showDebug?: boolean;
  className?: string;
}

// REQ-007: larghezza di riferimento desktop della preview. Sotto questa
// soglia la preview si restringe alla larghezza reale del container
// (auto-fit), mai oltre (comportamento desktop invariato).
const FLYER_PREVIEW_REF_WIDTH = 380;
const FLYER_PREVIEW_MAX_HEIGHT = 520;

export function FlyerPreview({ flyer, showDebug = false, className }: FlyerPreviewProps): React.ReactElement {
  // Auto-fit responsive (PAT-001, pattern CardPreviewSurface): si misura il
  // parent (flex container che occupa la colonna preview) via ResizeObserver
  // e si scala l'intera preview — proporzioni identiche mobile/desktop.
  // Il ref sta sul div preview ma si osserva il parent: osservare il div
  // stesso creerebbe un feedback loop (la sua width dipende da containerW).
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(FLYER_PREVIEW_REF_WIDTH);

  useEffect(() => {
    const el = fitRef.current?.parentElement;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setContainerW(w);
    };
    measure(el.clientWidth);
    // jsdom (test) può non avere ResizeObserver: resta il default REF_WIDTH.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      measure(entries[0]?.contentRect?.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + 6;
  const totalHmm = dims.h + 6;
  const maxPreviewW = Math.min(containerW, FLYER_PREVIEW_REF_WIDTH);
  const scale = Math.min(maxPreviewW / totalWmm, FLYER_PREVIEW_MAX_HEIGHT / totalHmm);
  const previewW = Number((totalWmm * scale).toFixed(2));
  const previewH = Number((totalHmm * scale).toFixed(2));
  const svg = buildFlyerSvg(flyer, { includeDebugBoxes: showDebug, previewW, previewH });

  return (
    <div
      ref={fitRef}
      className={`flyer-preview ${className || ''}`}
      style={{
        width: previewW,
        height: previewH,
        position: 'relative',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
      aria-label="Anteprima volantino"
      data-testid="flyer-preview"
      data-flyer-preview="true"
    >
      <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

export default FlyerPreview;
