import React from 'react';
import type { Flyer, FlyerContent } from '../../utils/documentSchemas';
import { FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX, FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX } from '../../utils/documentSchemas';
import { isHttpUrl } from '../../utils/qrGenerator';

interface FlyerContentFieldsProps {
  flyer: Flyer;
  onUpdateContent: (patch: Partial<FlyerContent>) => void;
}

export function FlyerContentFields({ flyer, onUpdateContent }: FlyerContentFieldsProps): React.ReactElement {
  const ctaUrlValid = !flyer.content.cta.url || isHttpUrl(flyer.content.cta.url);
  return (
    <div className="stack">
      <label>Titolo ({FLYER_HEADLINE_MAX - flyer.content.headline.length} car.)
        <input value={flyer.content.headline} maxLength={FLYER_HEADLINE_MAX} onChange={(e) => onUpdateContent({ headline: e.target.value })} placeholder="Es. Sagra del paese" />
      </label>
      <label>Sottotitolo ({FLYER_SUBHEADLINE_MAX - flyer.content.subheadline.length} car.)
        <input value={flyer.content.subheadline} maxLength={FLYER_SUBHEADLINE_MAX} onChange={(e) => onUpdateContent({ subheadline: e.target.value })} placeholder="Es. 15 agosto, ingresso gratis" />
      </label>
      <label>Corpo ({FLYER_BODY_MAX - flyer.content.body.length} car.)
        <textarea value={flyer.content.body} maxLength={FLYER_BODY_MAX} onChange={(e) => onUpdateContent({ body: e.target.value })} rows={4} placeholder="Es. Cibo tipico, musica dal vivo, ingresso gratuito." />
      </label>
      <div className="mini-row">
        <label>CTA (bottone stampato)
          <input value={flyer.content.cta.label} maxLength={FLYER_CTA_LABEL_MAX} onChange={(e) => onUpdateContent({ cta: { ...flyer.content.cta, label: e.target.value } })} placeholder="Prenota ora" />
        </label>
        <label>URL (per QR code)
          <input type="url" value={flyer.content.qrPayload} onChange={(e) => onUpdateContent({ qrPayload: e.target.value })} placeholder="https://example.com" aria-invalid={!!flyer.content.qrPayload && !ctaUrlValid} />
        </label>
      </div>
      <label>Etichetta QR (opzionale)
        <input value={flyer.content.qrLabel} onChange={(e) => onUpdateContent({ qrLabel: e.target.value })} placeholder="Scansiona per..." />
      </label>
    </div>
  );
}

export default FlyerContentFields;
