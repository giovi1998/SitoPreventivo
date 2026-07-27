import React from 'react';
import type { Flyer, FlyerSize, FlyerOrientation, FlyerLayout, FlyerContent } from '../../utils/documentSchemas';
import {
  FLYER_SIZES, FLYER_LAYOUTS, FLYER_SECTORS, FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX,
  FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX, FLYER_HERO_MAX_RAW_BYTES,
} from '../../utils/documentSchemas';
import type { FlyerCopyBudget } from '../../utils/flyer/budgets';
import { isHttpUrl } from '../../utils/qrGenerator';
import { getSizeLabel, getLayoutLabel, getSectorLabel } from '../../utils/flyer';
import FlyerStyleFields from './FlyerStyleFields';
import { AiSelect } from '../ai-ui';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  extra?: React.ReactNode;
  badge?: string | number;
  className?: string;
}

function Section({ title, defaultOpen = true, children, extra, badge, className }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''} ${className || ''}`}>
      <div className="collapsible-head" onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}>
        <span className="collapsible-title">
          {title}
          {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
        </span>
        <div className="collapsible-head-right">
          {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
          <svg className="collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

interface FlyerManualPanelProps {
  flyer: Flyer;
  showTemplateBanner: boolean;
  activeSector: typeof FLYER_SECTORS[number];
  showCustomFont: boolean;
  setShowCustomFont: (v: boolean) => void;
  limitReached: boolean;
  exporting: 'pdf' | 'png' | null;
  onCollapse: () => void;
  onTitleChange: (title: string) => void;
  onUpdateContent: (patch: Partial<FlyerContent>) => void;
  onUpdateStyle: <K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => void;
  onUpdateDecorations?: (patch: Partial<Flyer['decorations']>) => void;
  onUpdateSize: (size: FlyerSize) => void;
  onUpdateOrientation: (orientation: FlyerOrientation) => void;
  onUpdateLayout: (layout: FlyerLayout) => void;
  onApplySector: (sector: typeof FLYER_SECTORS[number]) => void;
  onApplySectorLayout: (layout: FlyerLayout) => void;
  onCloseTemplateBanner: () => void;
  onHeroUpload: (file: File) => void;
  onRemoveHero: () => void;
  onReset: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
  flyerHasContent: (flyer: Flyer) => boolean;
  budgetWarning?: string | null;
  copyBudget?: FlyerCopyBudget;
}

export function FlyerManualPanel({
  flyer, showTemplateBanner, activeSector, showCustomFont, setShowCustomFont,
  limitReached, exporting, onCollapse, onTitleChange, onUpdateContent, onUpdateStyle, onUpdateDecorations,
  onUpdateSize, onUpdateOrientation, onUpdateLayout, onApplySector, onApplySectorLayout,
  onCloseTemplateBanner, onHeroUpload, onRemoveHero,
  onReset, onSave, onExportPdf, onExportPng, flyerHasContent, budgetWarning, copyBudget,
}: FlyerManualPanelProps): React.ReactElement {
  const ctaUrlValid = !flyer.content.cta.url || isHttpUrl(flyer.content.cta.url);
  const headlineMax = Math.min(FLYER_HEADLINE_MAX, copyBudget?.headlineMaxChars ?? FLYER_HEADLINE_MAX);
  const subMax = Math.min(FLYER_SUBHEADLINE_MAX, copyBudget?.subheadlineMaxChars ?? FLYER_SUBHEADLINE_MAX);
  const bodyMax = Math.min(FLYER_BODY_MAX, copyBudget?.bodyMaxChars ?? FLYER_BODY_MAX);
  const ctaMax = Math.min(FLYER_CTA_LABEL_MAX, copyBudget?.ctaMaxChars ?? FLYER_CTA_LABEL_MAX);
  const qrLabelMax = copyBudget?.qrLabelMaxChars ?? 40;

  // Real-time residuals at the font size the layout engine actually chose.
  // These are more accurate than the hard max: they reflect what really fits.
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
    <section className="panel manual-panel" aria-label="Controllo manuale volantino">
      <div className="panel-kicker">
        <span>Controllo manuale</span>
        <button className="panel-toggle" onClick={onCollapse} title="Collassa" aria-label="Collassa manuale">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>
      <input value={flyer.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Titolo del volantino" className="flyer-title-input" aria-label="Titolo del volantino" />
      {showTemplateBanner && (
        <div className="flyer-template-banner" role="status">
          <div className="flyer-template-banner__header">
            <span className="flyer-template-banner__label">Template per settore:</span>
            <button type="button" className="flyer-template-banner__close" onClick={onCloseTemplateBanner} aria-label="Chiudi banner template" title="Chiudi">×</button>
          </div>
          <div className="flyer-template-banner__row">
            {FLYER_SECTORS.map((s) => <button key={s} type="button" onClick={() => onApplySector(s)}>{getSectorLabel(s)}</button>)}
          </div>
          <div className="flyer-template-banner__row">
            <span>Layout per {getSectorLabel(activeSector)}:</span>
            {FLYER_LAYOUTS.map((l) => <button key={l} type="button" onClick={() => onApplySectorLayout(l)}>{getLayoutLabel(l)}</button>)}
          </div>
        </div>
      )}
      {budgetWarning && (
        <div className="flyer-budget-warning" role="status">{budgetWarning}</div>
      )}
      <Section title="Formato" defaultOpen={false} badge={`${flyer.size}`} className="flyer-editor">
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
      </Section>
      <Section title="Layout" defaultOpen={true}>
        <div className="flyer-layout-buttons">
          {FLYER_LAYOUTS.map((l) => (
            <button key={l} type="button" onClick={() => onUpdateLayout(l)} aria-pressed={flyer.style.layout === l} className={flyer.style.layout === l ? 'active' : ''}>
              {getLayoutLabel(l)}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Contenuto" defaultOpen={true}>
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
      </Section>
      {flyer.style.layout !== 'centered' && (
      <Section title="Immagine hero" defaultOpen={false} badge={flyer.content.heroImage ? '1' : undefined}>
        <div className="stack">
          <label>
            Carica immagine hero
            <input type="file" aria-label="Carica immagine hero" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) onHeroUpload(f); }} />
          </label>
          <p style={{ fontSize: '.78rem', color: 'var(--muted)', margin: 0 }}>
            Carica un&apos;immagine manuale oppure usa il pannello AI Assist per generarla.
          </p>
          {flyer.content.heroImage && <button type="button" className="btn-remove" onClick={onRemoveHero}>Rimuovi immagine</button>}
        </div>
      </Section>
      )}
      <Section title="Stile" defaultOpen={false}>
        <FlyerStyleFields
          flyer={flyer}
          showCustomFont={showCustomFont}
          setShowCustomFont={setShowCustomFont}
          onUpdateStyle={onUpdateStyle}
          onUpdateDecorations={onUpdateDecorations}
        />
      </Section>
      <div className="editor-actions-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onReset}>Nuovo</button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={limitReached}>Salva</button>
        <button type="button" onClick={onExportPdf} disabled={exporting !== null || !flyerHasContent(flyer) || limitReached}>{exporting === 'pdf' ? '…' : 'PDF'}</button>
        <button type="button" onClick={onExportPng} disabled={exporting !== null || !flyerHasContent(flyer) || limitReached}>{exporting === 'png' ? '…' : 'PNG'}</button>
      </div>
      {limitReached && <p className="qr-warning" role="status" style={{ fontSize: '.78rem' }}>🔒 Limite free raggiunto. Sblocca per salvare ed esportare.</p>}
    </section>
  );
}

export default FlyerManualPanel;
