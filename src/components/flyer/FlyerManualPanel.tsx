import React from 'react';
import type { Flyer, FlyerSize, FlyerOrientation, FlyerLayout, FlyerContent } from '../../utils/documentSchemas';
import { FLYER_SECTORS } from '../../utils/documentSchemas';
import type { FlyerCopyBudget } from '../../utils/flyer/budgets';
import FlyerStyleFields from './FlyerStyleFields';
import FlyerContentFields from './FlyerContentFields';
import FlyerFormatControls from './FlyerFormatControls';
import FlyerLayoutControls from './FlyerLayoutControls';
import FlyerTemplatePicker from './FlyerTemplatePicker';
import FlyerExportActions from './FlyerExportActions';
import { DocumentAiStats } from '../DocumentAiStats';

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
  return (
    <section className="panel manual-panel" aria-label="Controllo manuale volantino">
      <div className="panel-kicker">
        <span>Controllo manuale</span>
        <button className="panel-toggle" onClick={onCollapse} title="Collassa" aria-label="Collassa manuale">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>
      <input value={flyer.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Titolo del volantino" className="flyer-title-input" aria-label="Titolo del volantino" />
      <div style={{ margin: '6px 0' }}>
        <DocumentAiStats aiStats={flyer.aiStats} />
      </div>

      <FlyerTemplatePicker
        showTemplateBanner={showTemplateBanner}
        activeSector={activeSector}
        onApplySector={onApplySector}
        onApplySectorLayout={onApplySectorLayout}
        onClose={onCloseTemplateBanner}
      />

      {budgetWarning && (
        <div className="flyer-budget-warning" role="status">{budgetWarning}</div>
      )}

      <Section title="Formato" defaultOpen={false} badge={`${flyer.size}`} className="flyer-editor">
        <FlyerFormatControls
          flyer={flyer}
          onUpdateSize={onUpdateSize}
          onUpdateOrientation={onUpdateOrientation}
        />
      </Section>

      <Section title="Layout" defaultOpen={true}>
        <FlyerLayoutControls
          flyer={flyer}
          onUpdateLayout={onUpdateLayout}
        />
      </Section>

      <Section title="Contenuto" defaultOpen={true}>
        <FlyerContentFields
          flyer={flyer}
          onUpdateContent={onUpdateContent}
          copyBudget={copyBudget}
        />
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

      <FlyerExportActions
        flyer={flyer}
        limitReached={limitReached}
        exporting={exporting}
        hasContent={flyerHasContent(flyer)}
        onReset={onReset}
        onSave={onSave}
        onExportPdf={onExportPdf}
        onExportPng={onExportPng}
      />
    </section>
  );
}

export default FlyerManualPanel;
