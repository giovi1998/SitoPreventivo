import React from 'react';
import { getFlyerDimensions } from '../../utils/documentSchemas';
import { buildFlyerSvg } from '../../utils/flyerGenerator';
import type { Flyer } from '../../utils/documentSchemas';

interface FlyerPreviewProps {
  flyer: Flyer;
  showDebug?: boolean;
  className?: string;
}

export function FlyerPreview({ flyer, showDebug = false, className }: FlyerPreviewProps): React.ReactElement {
  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + 6;
  const totalHmm = dims.h + 6;
  const maxPreviewW = 380;
  const maxPreviewH = 520;
  const scale = Math.min(maxPreviewW / totalWmm, maxPreviewH / totalHmm);
  const previewW = Number((totalWmm * scale).toFixed(2));
  const previewH = Number((totalHmm * scale).toFixed(2));
  const svg = buildFlyerSvg(flyer, { includeDebugBoxes: showDebug, previewW, previewH });

  return (
    <div
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
    >
      <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}

export default FlyerPreview;
