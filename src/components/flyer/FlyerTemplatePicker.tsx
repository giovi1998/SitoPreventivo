import React from 'react';
import { FLYER_SECTORS, FLYER_LAYOUTS } from '../../utils/documentSchemas';
import { getSectorLabel, getLayoutLabel } from '../../utils/flyer';

interface FlyerTemplatePickerProps {
  activeSector: typeof FLYER_SECTORS[number];
  showTemplateBanner: boolean;
  onApplySector: (sector: typeof FLYER_SECTORS[number]) => void;
  onApplySectorLayout: (layout: typeof FLYER_LAYOUTS[number]) => void;
  onClose: () => void;
}

export function FlyerTemplatePicker({ activeSector, showTemplateBanner, onApplySector, onApplySectorLayout, onClose }: FlyerTemplatePickerProps): React.ReactElement | null {
  if (!showTemplateBanner) return null;
  return (
    <div className="flyer-template-banner" role="status">
      <div className="flyer-template-banner__header">
        <span className="flyer-template-banner__label">Template per settore:</span>
        <button type="button" className="flyer-template-banner__close" onClick={onClose} aria-label="Chiudi banner template" title="Chiudi">×</button>
      </div>
      <div className="flyer-template-banner__row">
        {FLYER_SECTORS.map((s) => <button key={s} type="button" onClick={() => onApplySector(s)}>{getSectorLabel(s)}</button>)}
      </div>
      <div className="flyer-template-banner__row">
        <span>Layout per {getSectorLabel(activeSector)}:</span>
        {FLYER_LAYOUTS.map((l) => <button key={l} type="button" onClick={() => onApplySectorLayout(l)}>{getLayoutLabel(l)}</button>)}
      </div>
    </div>
  );
}

export default FlyerTemplatePicker;
