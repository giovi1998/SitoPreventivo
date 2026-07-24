import React from 'react';
import type { Flyer, FlyerLayout } from '../../utils/documentSchemas';
import { FLYER_LAYOUTS } from '../../utils/documentSchemas';
import { getLayoutLabel } from '../../utils/flyer';

interface FlyerLayoutControlsProps {
  flyer: Flyer;
  onUpdateLayout: (layout: FlyerLayout) => void;
}

export function FlyerLayoutControls({ flyer, onUpdateLayout }: FlyerLayoutControlsProps): React.ReactElement {
  return (
    <div className="flyer-layout-buttons">
      {FLYER_LAYOUTS.map((l) => (
        <button key={l} type="button" onClick={() => onUpdateLayout(l)} aria-pressed={flyer.style.layout === l} className={flyer.style.layout === l ? 'active' : ''}>
          {getLayoutLabel(l)}
        </button>
      ))}
    </div>
  );
}

export default FlyerLayoutControls;
