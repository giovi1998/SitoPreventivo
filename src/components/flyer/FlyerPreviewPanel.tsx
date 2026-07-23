import React from 'react';
import PreviewWatermark from '../PreviewWatermark';
import FlyerPreview from './FlyerPreview';
import type { Flyer } from '../../utils/documentSchemas';
import type { FlyerLayoutPlan } from '../../utils/flyer';
import { getLayoutLabel } from '../../utils/flyer';

interface FlyerPreviewPanelProps {
  flyer: Flyer;
  plan: FlyerLayoutPlan;
  tier: 'free' | 'unlocked';
  previewFocus: boolean;
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  setPreviewFocus: (v: boolean) => void;
  onCollapse: () => void;
}

export function FlyerPreviewPanel({
  flyer, plan, tier, previewFocus, showDebug, setShowDebug, setPreviewFocus, onCollapse,
}: FlyerPreviewPanelProps): React.ReactElement {
  const densityLabel: Record<typeof plan.density, string> = {
    low: 'Spazio ok',
    medium: 'Spazio ok',
    high: 'Quasi pieno',
    overflow: 'Troppo testo',
  };

  return (
    <section className={`preview-wrap ${previewFocus ? 'preview-focus' : ''}`} aria-label="Anteprima volantino">
      <div className="preview-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <button type="button" className="preview-debug-toggle" onClick={() => setShowDebug(!showDebug)} aria-pressed={showDebug}>
          {showDebug ? 'Nascondi debug' : 'Debug'}
        </button>
        <button data-testid="focus-toggle" className="focus-toggle" onClick={() => setPreviewFocus(!previewFocus)} title={previewFocus ? 'Esci da focus' : 'Focus anteprima'} aria-label={previewFocus ? 'Esci da focus' : 'Focus anteprima'}>
          <span style={{ fontSize: '.72rem', fontWeight: 600 }}>{previewFocus ? '✕' : '🎯'}</span>
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', position: 'relative' }}>
        <FlyerPreview flyer={flyer} showDebug={showDebug} />
        <PreviewWatermark tier={tier} className="flyer-preview-watermark" />
      </div>
      <div className="flyer-preview-meta">
        <span>{flyer.size}{flyer.size === 'Square' ? '' : ` · ${flyer.orientation === 'portrait' ? 'Verticale' : 'Orizzontale'}`} · {getLayoutLabel(flyer.style.layout)}</span>
        <span className={`flyer-density-badge ${plan.density}`}>{densityLabel[plan.density]}</span>
        {tier === 'free' && <span>· Watermark QUICKBRAND</span>}
      </div>
      {plan.warnings.length > 0 && (
        <div className="flyer-preview-warnings" role="list">
          {plan.warnings.map((w, i) => (
            <div key={i} className={`flyer-warning-${w.severity}`} role="listitem">{w.message}</div>
          ))}
        </div>
      )}
    </section>
  );
}

export default FlyerPreviewPanel;
