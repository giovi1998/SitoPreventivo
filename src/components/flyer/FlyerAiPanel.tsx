import React from 'react';
import AILogPanel from '../AILogPanel';
import type { Flyer, FlyerTone } from '../../utils/documentSchemas';
import { FLYER_BRIEF_MAX, FLYER_SECTORS } from '../../utils/documentSchemas';
import type { useAIFlyer } from '../../hooks/useAIFlyer';
import { getSectorLabel } from '../../utils/flyer';
import {
  AiSection,
  AiPromptTextarea,
  AiSelect,
  AiGenerateButton,
  AiActionChip,
  AiQuickActionCard,
  AiActionGrid,
  AiTierGuard,
  AiPromptLibrary,
} from '../ai-ui';
import type { PromptLibraryEntry } from '../../utils/promptLibrary';
import { AI_IMAGE_MODELS, getAiImageModelDefault, setAiImageModelDefault } from '../../utils/uiPrefs';

const SUGGESTED_PROMPTS: string[] = [
  'Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo, cucina tipica',
  'Cena di degustazione, 5 portate, venerdì 20:30, posti limitati',
  'Apertura nuovo negozio, via Roma 23, sconto 10% il giorno dell\'inaugurazione',
  'Salone bellezza, promo taglio+piega -20%, valido solo questo weekend',
  'Notte bianca in centro, negozi aperti fino a mezzanotte, musica dal vivo',
];

const QUICK_REFINE: Array<{ action: 'simplify' | 'formal' | 'young' | 'urgent'; label: string; icon: string; description: string }> = [
  { action: 'simplify', label: 'Semplifica', icon: '✂️', description: 'Riduci il body, mantieni headline' },
  { action: 'formal', label: 'Più formale', icon: '🎩', description: 'Riformula in tono professionale' },
  { action: 'young', label: 'Più giovanile', icon: '⚡', description: 'Riformula in tono diretto e fresco' },
  { action: 'urgent', label: 'Più urgenza', icon: '⏰', description: 'Aggiungi scarsità nel body e nella CTA' },
];

interface FlyerAiPanelProps {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiTone: FlyerTone;
  setAiTone: (v: FlyerTone) => void;
  ai: ReturnType<typeof useAIFlyer>;
  flyer: Flyer;
  debouncedFlyer: Flyer;
  hasCopy: boolean;
  onGenerate: () => void;
  onRefine: (action: 'simplify' | 'formal' | 'young' | 'urgent') => void;
  onReset: () => void;
  onCollapse: () => void;
  tier?: 'free' | 'unlocked';
  /**
   * Phase 14 (REQ-AI-002): dentro la AIConsole rail l'header "AI Assist",
   * il bottone collapse e la sezione Log AI sono forniti dalla console —
   * `bare` li nasconde per evitare duplicati.
   */
  bare?: boolean;
  /**
   * Se false, nasconde il bottone "Nuova sessione" nel pannello AI
   * perché la console rail lo fornisce già come quick action.
   */
  showResetInRail?: boolean;
  onGenerateHero?: (imageModel?: string) => void;
  onRemoveHero?: () => void;
  onResetHero?: () => void;
  isGeneratingHero?: boolean;
  heroPrompt?: string;
  setHeroPrompt?: (v: string) => void;
  heroSector?: typeof FLYER_SECTORS[number];
  setHeroSector?: (v: typeof FLYER_SECTORS[number]) => void;
  heroTone?: FlyerTone;
  setHeroTone?: (v: FlyerTone) => void;
  showHeroPromptEditor?: boolean;
  setShowHeroPromptEditor?: (v: boolean) => void;
  heroLibrary?: PromptLibraryEntry[];
  onSaveHeroPrompt?: () => void;
  onApplyHeroPrompt?: (entry: PromptLibraryEntry) => void;
  onDeleteHeroPrompt?: (id: string) => void;
}

export function FlyerAiPanel({
  aiPrompt, setAiPrompt, aiTone, setAiTone, ai,
  flyer,   onGenerate, onRefine, onReset, hasCopy, onCollapse,
  tier = 'free', bare = false, showResetInRail = true,
  onGenerateHero, onRemoveHero, onResetHero, isGeneratingHero = false,
  heroPrompt = '', setHeroPrompt, heroSector, setHeroSector,
  heroTone = 'formale', setHeroTone,
  showHeroPromptEditor = false, setShowHeroPromptEditor,
  heroLibrary = [], onSaveHeroPrompt, onApplyHeroPrompt, onDeleteHeroPrompt,
}: FlyerAiPanelProps): React.ReactElement {
  const [imageModel, setImageModel] = React.useState(getAiImageModelDefault());
  const handleImageModelChange = (id: string) => {
    setImageModel(id);
    setAiImageModelDefault(id);
  };

  const toneOptions = [
    { value: 'formale', label: 'Formale' },
    { value: 'giovanile', label: 'Giovanile' },
    { value: 'tecnico', label: 'Tecnico' },
  ];

  return (
    <section className="panel ai-panel" aria-label="AI Assist del volantino">
      {!bare && (
        <div className="panel-kicker">
          <span>AI Assist</span>
          <button className="panel-toggle" onClick={onCollapse} title="Collassa" aria-label="Collassa AI">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        </div>
      )}

      {onGenerateHero && flyer.style.layout !== 'centered' && (
        <AiSection title="Hero Image" collapsible defaultOpen={false} hint="Immagine hero del volantino generata da AI.">
          <AiTierGuard tier={tier} featureName="Hero AI">
            <div className="stack">
              {flyer.content.heroImage && (
                <img
                  src={flyer.content.heroImage}
                  alt="Hero attuale"
                  style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6 }}
                />
              )}
              <div className="mini-row">
                {heroSector && setHeroSector && (
                  <AiSelect
                    label="Settore"
                    value={heroSector}
                    onChange={(e) => setHeroSector(e.target.value as typeof FLYER_SECTORS[number])}
                    options={FLYER_SECTORS.map((s) => ({ value: s, label: getSectorLabel(s) }))}
                  />
                )}
                {setHeroTone && (
                  <AiSelect
                    label="Tono"
                    value={heroTone}
                    onChange={(e) => setHeroTone(e.target.value as FlyerTone)}
                    options={[
                      { value: 'formale', label: 'Formale' },
                      { value: 'giovanile', label: 'Giovanile' },
                      { value: 'tecnico', label: 'Tecnico' },
                    ]}
                  />
                )}
              </div>
              <AiSelect
                label="Modello immagine"
                value={imageModel}
                onChange={(e) => handleImageModelChange(e.target.value)}
                options={AI_IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name }))}
                hint={AI_IMAGE_MODELS.find((m) => m.id === imageModel)?.description}
              />
              {setShowHeroPromptEditor && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowHeroPromptEditor(!showHeroPromptEditor)}
                  disabled={isGeneratingHero}
                >
                  {showHeroPromptEditor ? 'Nascondi prompt' : 'Modifica prompt'}
                </button>
              )}
              {showHeroPromptEditor && setHeroPrompt && (
                <>
                  <AiPromptTextarea
                    label="Prompt hero"
                    value={heroPrompt}
                    onChange={(e) => setHeroPrompt(e.target.value.slice(0, 1500))}
                    rows={3}
                    maxLength={1500}
                    placeholder="Vuoto = prompt automatico da settore/tono"
                  />
                  {onSaveHeroPrompt && onApplyHeroPrompt && onDeleteHeroPrompt && (
                    <AiPromptLibrary
                      items={heroLibrary}
                      onSave={onSaveHeroPrompt}
                      onApply={onApplyHeroPrompt}
                      onDelete={onDeleteHeroPrompt}
                      saveDisabled={!heroPrompt.trim()}
                      title="I miei prompt hero"
                    />
                  )}
                </>
              )}
              <AiGenerateButton
                isProcessing={isGeneratingHero}
                loadingText="Generazione…"
                onClick={() => onGenerateHero?.(imageModel)}
              >
                Genera hero AI
              </AiGenerateButton>
              {flyer.content.heroImage?.startsWith('data:') && onResetHero && (
                <button type="button" className="btn-remove" onClick={onResetHero}>
                  Ripristina immagine default
                </button>
              )}
              {flyer.content.heroImage && onRemoveHero && (
                <button type="button" className="btn-remove" onClick={onRemoveHero}>
                  Rimuovi immagine
                </button>
              )}
            </div>
          </AiTierGuard>
        </AiSection>
      )}

      <AiSection title="Genera copy" collapsible defaultOpen>
        <div className="stack">
          <AiSelect 
            label="Tono" 
            value={aiTone} 
            onChange={(e) => setAiTone(e.target.value as FlyerTone)} 
            options={toneOptions} 
          />
          <AiPromptTextarea 
            label="Brief"
            value={aiPrompt}
            maxLength={FLYER_BRIEF_MAX}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Es. Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo"
            rows={3}
            aria-label="Brief AI"
          />
          <AiGenerateButton 
            isProcessing={ai.isProcessing} 
            loadingText="Generazione…" 
            onClick={onGenerate} 
            disabled={!aiPrompt.trim()}
          >
            ✨ Genera copy
          </AiGenerateButton>
        </div>
      </AiSection>

      <AiSection title="Suggerimenti" collapsible defaultOpen>
        <AiActionGrid>
          {SUGGESTED_PROMPTS.map((p) => (
            <AiActionChip 
              key={p} 
              label={p} 
              onClick={() => setAiPrompt(p)} 
              disabled={ai.isProcessing} 
            />
          ))}
        </AiActionGrid>
      </AiSection>

      <AiSection title="Raffina copy" collapsible defaultOpen>
        <AiActionGrid>
          {QUICK_REFINE.map((q) => (
            <AiQuickActionCard 
              key={q.action} 
              icon={q.icon}
              label={q.label}
              description={q.description}
              onClick={() => onRefine(q.action)} 
              disabled={ai.isProcessing || !hasCopy} 
            />
          ))}
        </AiActionGrid>
        {!hasCopy && <p style={{ fontSize: '.78rem', color: 'var(--muted)', margin: '6px 0 0' }}>ℹ️ Genera prima il copy o compila manualmente i campi.</p>}
      </AiSection>

      {!bare && (
        <AiSection
          title="Log AI"
          collapsible
          defaultOpen
          extra={showResetInRail ? <button type="button" className="card-ai-reset" onClick={onReset} disabled={ai.isProcessing}>↻ Nuova sessione</button> : null}
        >
          <AILogPanel logs={ai.logs} isProcessing={ai.isProcessing} />
        </AiSection>
      )}
    </section>
  );
}

export default FlyerAiPanel;
