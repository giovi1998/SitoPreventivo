import React from 'react';
import type { Flyer, FlyerSize, FlyerOrientation } from '../../utils/documentSchemas';
import { FLYER_SIZES } from '../../utils/documentSchemas';
import { getSizeLabel } from '../../utils/flyer';

interface FlyerFormatControlsProps {
  flyer: Flyer;
  onUpdateSize: (size: FlyerSize) => void;
  onUpdateOrientation: (orientation: FlyerOrientation) => void;
}

export function FlyerFormatControls({ flyer, onUpdateSize, onUpdateOrientation }: FlyerFormatControlsProps): React.ReactElement {
  return (
    <div className="flyer-format-grid">
      <label>Dimensione
        <select value={flyer.size} onChange={(e) => onUpdateSize(e.target.value as FlyerSize)}>
          {FLYER_SIZES.map((s) => <option key={s} value={s}>{getSizeLabel(s)}</option>)}
        </select>
      </label>
      {flyer.size !== 'Square' && (
        <label>Orientamento
          <select value={flyer.orientation} onChange={(e) => onUpdateOrientation(e.target.value as FlyerOrientation)}>
            <option value="portrait">Verticale</option>
            <option value="landscape">Orizzontale</option>
          </select>
        </label>
      )}
    </div>
  );
}

export default FlyerFormatControls;
