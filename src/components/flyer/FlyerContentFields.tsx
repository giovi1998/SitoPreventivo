import React from 'react';
import type { Flyer, FlyerContent } from '../../utils/documentSchemas';
import { FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX, FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX } from '../../utils/documentSchemas';
import type { FlyerCopyBudget } from '../../utils/flyer/budgets';
import { isHttpUrl } from '../../utils/qrGenerator';

interface FlyerContentFieldsProps {
  flyer: Flyer;
  onUpdateContent: (patch: Partial<FlyerContent>) => void;
  copyBudget?: FlyerCopyBudget;
}

export function FlyerContentFields({ flyer, onUpdateContent, copyBudget }: FlyerContentFieldsProps): React.ReactElement {
  const ctaUrlValid = !flyer.content.cta.url || isHttpUrl(flyer.content.cta.url);

  const headlineMax = Math.min(FLYER_HEADLINE_MAX, copyBudget?.headlineMaxChars ?? FLYER_HEADLINE_MAX);
  const subMax = Math.min(FLYER_SUBHEADLINE_MAX, copyBudget?.subheadlineMaxChars ?? FLYER_SUBHEADLINE_MAX);
  const bodyMax = Math.min(FLYER_BODY_MAX, copyBudget?.bodyMaxChars ?? FLYER_BODY_MAX);
  const ctaMax = Math.min(FLYER_CTA_LABEL_MAX, copyBudget?.ctaMaxChars ?? FLYER_CTA_LABEL_MAX);
  const qrLabelMax = copyBudget?.qrLabelMaxChars ?? 40;

  const headlineResidual = copyBudget?.realHeadlineChars != null
    ? Math.max(0, copyBudget.realHeadlineChars - flyer.content.headline.length)
    : headlineMax - flyer.content.headline.length;
  const subResidual = copyBudget?.realSubheadlineChars != null
    ? Math.max(0, copyBudget.realSubheadlineChars - flyer.content.subheadline.length)
    : subMax - flyer.content.subheadline.length;
  const bodyResidual = copyBudget?.realBodyChars != null
    ? Math.max(0, copyBudget.realBodyChars - flyer.content.body.length)
    : bodyMax - flyer.content.body.length;

  return (
    <div className="stack">
      <label>Titolo ({headlineResidual} car. residui){copyBudget?.headlineTruncated && <span className="flyer-truncation-warning" role="status"> ⚠ testo troncato</span>}
        <input value={flyer.content.headline} maxLength={headlineMax} onChange={(e) => onUpdateContent({ headline: e.target.value })} placeholder="Es. Sagra del paese" />
      </label>
      <label>Sottotitolo ({subResidual} car. residui){copyBudget?.subheadlineTruncated && <span className="flyer-truncation-warning" role="status"> ⚠ testo troncato</span>}
        <input value={flyer.content.subheadline} maxLength={subMax} onChange={(e) => onUpdateContent({ subheadline: e.target.value })} placeholder="Es. 15 agosto, ingresso gratis" />
      </label>
      <label>Corpo ({bodyResidual} car. residui){copyBudget?.bodyTruncated && <span className="flyer-truncation-warning" role="status"> ⚠ testo troncato, riduci o scegli formato più grande</span>}
        <textarea value={flyer.content.body} maxLength={bodyMax} onChange={(e) => onUpdateContent({ body: e.target.value })} rows={4} placeholder="Es. Cibo tipico, musica dal vivo, ingresso gratuito." />
      </label>
      <div className="mini-row">
        <label>CTA (bottone stampato)
          <input value={flyer.content.cta.label} maxLength={ctaMax} onChange={(e) => onUpdateContent({ cta: { ...flyer.content.cta, label: e.target.value } })} placeholder="Prenota ora" />
        </label>
        <label>URL (per QR code)
          <input type="url" value={flyer.content.qrPayload} onChange={(e) => onUpdateContent({ qrPayload: e.target.value })} placeholder="https://example.com" aria-invalid={!!flyer.content.qrPayload && !ctaUrlValid} />
        </label>
      </div>
      <label>Etichetta QR (opzionale, max {qrLabelMax} car.)
        <input value={flyer.content.qrLabel} maxLength={qrLabelMax} onChange={(e) => onUpdateContent({ qrLabel: e.target.value })} placeholder="Scansiona per..." />
      </label>
    </div>
  );
}

export default FlyerContentFields;
