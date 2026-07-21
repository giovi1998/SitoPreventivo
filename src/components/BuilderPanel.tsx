import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Coffee, Utensils, Wine, Pizza, Cake,
  ChefHat, Drumstick, IceCreamCone, Apple, Sandwich,
  Code, Cpu, Database, Cloud, Terminal,
  Server, Smartphone, Wifi, Zap, Layers,
  Shirt, Scissors, Sparkles, Gem, Crown,
  Watch, ShoppingBag, Palette, Frame,
  Briefcase, Building, Scale, Stethoscope, BookOpen,
  GraduationCap, Hammer, Wrench, Lightbulb, Globe,
  Leaf, TreePine, Flower, Mountain, Sun,
  Moon, Star, Flame, Waves,
  Search,
} from 'lucide-react';
import type { Logo, LogoBuilder, LogoIconType, LogoIconShape, LogoLayout, LogoSector } from '../utils/documentSchemas';
import { LUCIDE_ICONS } from '../utils/logoGenerator';
import { builderToSvg, sanitizeSvg, isValidLucideIcon, isHexColor } from '../utils/logoGenerator';
import type { Tier } from '../utils/watermark';
import PreviewWatermark from './PreviewWatermark';
import { useAILogo } from '../hooks/useAILogo';
import { useToast } from '../hooks/useToast';
import { AiFontPicker } from './ai-ui';

interface BuilderPanelProps {
  logo: Logo;
  onPatch: (path: string, value: any) => void;
  onTemplate?: (sector: LogoSector) => void;
  tier?: Tier;
  userEmail?: string;
}

const LUCIDE_NAME_TO_COMPONENT: Record<string, React.ComponentType<any>> = {
  coffee: Coffee, utensils: Utensils, wine: Wine, pizza: Pizza, cake: Cake,
  'chef-hat': ChefHat, drumstick: Drumstick, 'ice-cream-cone': IceCreamCone, lemon: Apple, sandwich: Sandwich,
  code: Code, cpu: Cpu, database: Database, cloud: Cloud, terminal: Terminal,
  server: Server, smartphone: Smartphone, wifi: Wifi, zap: Zap, layers: Layers,
  shirt: Shirt, scissors: Scissors, sparkles: Sparkles, gem: Gem, crown: Crown,
  watch: Watch, 'shopping-bag': ShoppingBag, palette: Palette, frame: Frame,
  briefcase: Briefcase, building: Building, scale: Scale, stethoscope: Stethoscope, 'book-open': BookOpen,
  'graduation-cap': GraduationCap, hammer: Hammer, wrench: Wrench, lightbulb: Lightbulb, globe: Globe,
  leaf: Leaf, 'tree-pine': TreePine, flower: Flower, mountain: Mountain, sun: Sun,
  moon: Moon, star: Star, flame: Flame, waves: Waves,
};

const SECTOR_LABELS: Record<LogoSector, string> = {
  tech: 'Tech',
  food: 'Food',
  fashion: 'Fashion',
  professionista: 'Professionista',
};

const LAYOUT_OPTIONS: LogoLayout[] = ['horizontal', 'vertical', 'stacked'];
const ICON_SHAPE_OPTIONS: LogoIconShape[] = ['circle', 'square', 'rounded', 'hex'];
const DECORATION_OPTIONS: { value: import('../utils/documentSchemas').LogoDecorativeElement; label: string }[] = [
  { value: 'underline', label: 'Sottolineatura' },
  { value: 'dotRing', label: 'Anello punti' },
  { value: 'topAccent', label: 'Accent superiore' },
];
const BACKGROUND_PRESETS = [
  { label: 'Nessuno', value: '' },
  { label: 'Chiaro', value: '#FFFFFF' },
  { label: 'Scuro', value: '#0F172A' },
  { label: 'Neutro', value: '#F5F5F4' },
];
const TEXT_COLOR_MODE_OPTIONS: { value: import('../utils/documentSchemas').LogoBuilder['textColorMode']; label: string }[] = [
  { value: 'auto', label: 'Automatico' },
  { value: 'light', label: 'Chiaro (bianco)' },
  { value: 'dark', label: 'Scuro' },
];
const TEXT_BACKDROP_OPTIONS: { value: import('../utils/documentSchemas').LogoBuilder['textBackdrop']; label: string }[] = [
  { value: 'none', label: 'Nessuno' },
  { value: 'pill', label: 'Pillola' },
  { value: 'band', label: 'Banda' },
];
const TEXT_POSITION_OPTIONS: { value: import('../utils/documentSchemas').LogoBuilder['textPosition']; label: string }[] = [
  { value: 'overlay', label: 'Sovrapposto' },
  { value: 'above', label: 'Sopra' },
  { value: 'below', label: 'Sotto' },
];
const TEXT_OFFSET_STEP = 4;
const TEXT_OFFSET_LIMIT = 60;

function clampOffset(v: number): number {
  return Math.max(-TEXT_OFFSET_LIMIT, Math.min(TEXT_OFFSET_LIMIT, v));
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function PreviewIcon({ builder }: { builder: LogoBuilder }) {
  if (builder.iconType === 'none' || !builder.iconGlyph) {
    return null;
  }
  let IconComp: React.ComponentType<any> | null = null;
  if (builder.iconType === 'lucide' && isValidLucideIcon(builder.iconGlyph)) {
    IconComp = LUCIDE_NAME_TO_COMPONENT[builder.iconGlyph] || null;
  } else if (builder.iconType === 'monogram') {
    return null; // monogram è solo lettere, non un'icona lucide
  } else if (builder.iconType === 'shape') {
    return null; // shape è solo la forma geometrica
  }
  if (!IconComp) return null;
  return <IconComp size={20} aria-hidden="true" />;
}

export default function BuilderPanel({ logo, onPatch, onTemplate, tier = 'unlocked', userEmail }: BuilderPanelProps) {
  const b = logo.builder;
  const [search, setSearch] = useState('');
  const debouncedBuilder = useDebouncedValue(b, 200);
  const { generateBackground, isGeneratingBg } = useAILogo(userEmail);
  const { addToast } = useToast();
  const [promptDraft, setPromptDraft] = useState(b.imagePrompt || '');
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const previewSvg = useMemo(() => {
    try {
      return sanitizeSvg(builderToSvg(debouncedBuilder));
    } catch {
      return '';
    }
  }, [debouncedBuilder]);

  const update = useCallback((key: keyof LogoBuilder, value: any) => {
    onPatch(`builder.${key}`, value);
  }, [onPatch]);

  // Keep the prompt draft in sync when the applied imagePrompt changes
  // (e.g. after a regeneration from the AI tab or a new concept applied).
  useEffect(() => {
    setPromptDraft(b.imagePrompt || '');
  }, [b.imagePrompt]);

  const handleRegenerateBackground = useCallback(async () => {
    const promptText = promptDraft.trim();
    if (!promptText) {
      addToast('info', 'Scrivi un prompt per rigenerare lo sfondo.');
      return;
    }
    addToast('info', 'Rigenerazione sfondo AI in corso…');
    try {
      const result = await generateBackground(logo, {
        activity: '',
        mood: 'minimal',
        target: '',
        imagePrompt: promptText,
      });
      if (result.applied && result.logo?.builder.backgroundImage) {
        onPatch('builder.backgroundImage', result.logo.builder.backgroundImage);
        onPatch('builder.imagePrompt', promptText);
        addToast('success', 'Sfondo AI rigenerato.');
      } else {
        addToast('error', `Rigenerazione fallita: ${result.error ?? 'errore sconosciuto'}`);
      }
    } catch (err) {
      addToast('error', `Errore rigenerazione: ${(err as Error)?.message ?? 'unknown'}`);
    }
  }, [promptDraft, logo, generateBackground, onPatch, addToast]);

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LUCIDE_ICONS;
    return LUCIDE_ICONS.filter((name) => name.includes(q));
  }, [search]);

  const onIconTypeChange = (value: LogoIconType) => {
    update('iconType', value);
    if (value === 'none') {
      update('iconGlyph', '');
    } else if (value === 'lucide' && !b.iconGlyph) {
      update('iconGlyph', LUCIDE_ICONS[0]);
    } else if (value === 'monogram' && !b.iconGlyph) {
      update('iconGlyph', 'AB');
    } else if (value === 'shape' && !b.iconGlyph) {
      update('iconGlyph', 'A');
    }
  };

  const onMonogramChange = (raw: string) => {
    const upper = raw.toUpperCase().slice(0, 2);
    update('iconGlyph', upper);
  };

  return (
    <div className="builder-panel">
      <section className="builder-form" aria-label="Configurazione logo">
        <fieldset className="builder-fieldset">
          <legend>Template per settore</legend>
          <div className="builder-template-row" role="group" aria-label="Settore template">
            {(['tech', 'food', 'fashion', 'professionista'] as LogoSector[]).map((s) => (
              <button
                key={s}
                type="button"
                className="builder-template-btn"
                onClick={() => onTemplate && onTemplate(s)}
                title={`Carica template ${SECTOR_LABELS[s]}`}
              >
                {SECTOR_LABELS[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="builder-fieldset">
          <legend>Testo</legend>
          <label className="builder-field">
            <span>Testo principale</span>
            <input
              type="text"
              value={b.primaryText}
              maxLength={50}
              onChange={(e) => update('primaryText', e.target.value)}
              aria-label="Testo principale"
            />
          </label>
          <label className="builder-field">
            <span>Sottotitolo (opzionale)</span>
            <input
              type="text"
              value={b.tagline}
              maxLength={50}
              onChange={(e) => update('tagline', e.target.value)}
              aria-label="Sottotitolo"
            />
          </label>
        </fieldset>

        <fieldset className="builder-fieldset">
          <legend>Icona</legend>
          <label className="builder-field">
            <span>Tipo icona</span>
            <select
              value={b.iconType}
              onChange={(e) => onIconTypeChange(e.target.value as LogoIconType)}
              aria-label="Tipo icona"
            >
              <option value="none">Nessuna</option>
              <option value="shape">Forma geometrica</option>
              <option value="monogram">Monogramma (lettere)</option>
              <option value="lucide">Lucide (icona)</option>
            </select>
          </label>

          {b.iconType === 'monogram' && (
            <label className="builder-field">
              <span>Lettere monogramma (max 2)</span>
              <input
                type="text"
                value={b.iconGlyph}
                maxLength={2}
                onChange={(e) => onMonogramChange(e.target.value)}
                aria-label="Lettere monogramma"
                placeholder="AC"
              />
            </label>
          )}

          {b.iconType === 'lucide' && (
            <div className="builder-field">
              <span className="builder-field-label">Icona Lucide</span>
              <div className="builder-icon-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca icona…"
                  aria-label="Cerca icona"
                />
              </div>
              <div className="builder-icon-grid" role="listbox" aria-label="Icone disponibili">
                {filteredIcons.map((name) => {
                  const Comp = LUCIDE_NAME_TO_COMPONENT[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={b.iconGlyph === name}
                      aria-label={`Scegli icona ${name}`}
                      title={name}
                      className={`builder-icon-btn${b.iconGlyph === name ? ' selected' : ''}`}
                      onClick={() => update('iconGlyph', name)}
                    >
                      {Comp ? <Comp size={18} aria-hidden="true" /> : null}
                      <span className="builder-icon-name">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {b.iconType !== 'none' && (
            <label className="builder-field">
              <span>Forma icona</span>
              <select
                value={b.iconShape}
                onChange={(e) => update('iconShape', e.target.value as LogoIconShape)}
                aria-label="Forma icona"
              >
                {ICON_SHAPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        <fieldset className="builder-fieldset">
          <legend>Stile</legend>
          <label className="builder-field">
            <span>Colore principale</span>
            <input
              type="color"
              value={isHexColor(b.primaryColor) ? b.primaryColor : '#01696F'}
              onChange={(e) => update('primaryColor', e.target.value)}
              aria-label="Colore principale"
            />
          </label>
          <label className="builder-field">
            <span>Colore secondario</span>
            <input
              type="color"
              value={isHexColor(b.secondaryColor) ? b.secondaryColor : '#1a1a2e'}
              onChange={(e) => update('secondaryColor', e.target.value)}
              aria-label="Colore secondario"
            />
          </label>
          <AiFontPicker
            label="Font"
            value={b.fontFamily}
            onChange={(font) => update('fontFamily', font)}
            aria-label="Font"
          />
          <label className="builder-field">
            <span>Layout</span>
            <select
              value={b.layout}
              onChange={(e) => update('layout', e.target.value as LogoLayout)}
              aria-label="Layout"
            >
              {LAYOUT_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
        </fieldset>

        <fieldset className="builder-fieldset">
          <legend>Decorazioni</legend>
          <label className="builder-field builder-field-inline">
            <input
              type="checkbox"
              checked={b.gradientFill}
              onChange={(e) => update('gradientFill', e.target.checked)}
              aria-label="Gradient sui colori"
            />
            <span>Gradient sui colori</span>
          </label>
          <label className="builder-field">
            <span>Sfondo brandato</span>
            <div className="builder-color-row">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`builder-color-preset${(!b.backgroundColor && preset.value === '') || b.backgroundColor === preset.value ? ' selected' : ''}`}
                  onClick={() => update('backgroundColor', preset.value || null)}
                  title={preset.label}
                  aria-label={`Sfondo ${preset.label}`}
                >
                  {preset.value ? (
                    <span className="builder-color-swatch" style={{ background: preset.value }} />
                  ) : (
                    <span className="builder-color-swatch transparent" />
                  )}
                  <span className="builder-color-label">{preset.label}</span>
                </button>
              ))}
              <input
                type="color"
                value={isHexColor(b.backgroundColor || '') ? (b.backgroundColor as string) : '#FFFFFF'}
                onChange={(e) => update('backgroundColor', e.target.value)}
                aria-label="Sfondo brandato personalizzato"
                title="Colore personalizzato"
              />
            </div>
          </label>
          <div className="builder-field">
            <span className="builder-field-label">Elementi decorativi</span>
            <div className="builder-chip-group" role="group" aria-label="Elementi decorativi">
              {DECORATION_OPTIONS.map((d) => {
                const active = b.decorativeElements.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    className={`builder-chip${active ? ' active' : ''}`}
                    onClick={() => {
                      const next = active
                        ? b.decorativeElements.filter((x) => x !== d.value)
                        : [...b.decorativeElements, d.value];
                      update('decorativeElements', next);
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        <fieldset className="builder-fieldset">
          <legend>Leggibilità testo</legend>
          <p className="builder-field-hint">
            Utile quando il testo è sovrapposto a un background AI e risulta poco leggibile.
          </p>
          <label className="builder-field">
            <span>Colore testo</span>
            <select
              value={b.textColorMode}
              onChange={(e) => update('textColorMode', e.target.value)}
              aria-label="Colore testo"
            >
              {TEXT_COLOR_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="builder-field">
            <span>Sfondo dietro al testo</span>
            <div className="builder-color-row" role="group" aria-label="Sfondo dietro al testo">
              {TEXT_BACKDROP_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`builder-color-preset${b.textBackdrop === o.value ? ' selected' : ''}`}
                  onClick={() => update('textBackdrop', o.value)}
                  aria-label={`Sfondo testo ${o.label}`}
                  title={o.label}
                >
                  <span className="builder-color-label">{o.label}</span>
                </button>
              ))}
            </div>
          </label>
          {b.backgroundImage && (
            <label className="builder-field">
              <span>Posizione testo</span>
              <div className="builder-color-row" role="group" aria-label="Posizione testo">
                {TEXT_POSITION_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`builder-color-preset${b.textPosition === o.value ? ' selected' : ''}`}
                    onClick={() => update('textPosition', o.value)}
                    aria-label={`Testo ${o.label}`}
                    title={o.label}
                  >
                    <span className="builder-color-label">{o.label}</span>
                  </button>
                ))}
              </div>
            </label>
          )}
          <label className="builder-field">
            <span>Dimensione testo ({Math.round(b.textScale * 100)}%)</span>
            <input
              type="range"
              min={0.7}
              max={1.5}
              step={0.05}
              value={b.textScale}
              onChange={(e) => update('textScale', Number(e.target.value))}
              aria-label="Dimensione testo"
            />
          </label>
          <div className="builder-field">
            <span className="builder-field-label">Posizione titolo all'interno del background</span>
            <div className="builder-nudge-grid" role="group" aria-label="Posizione titolo all'interno del background">
              <button
                type="button"
                className="builder-nudge-btn nudge-up"
                onClick={() => update('textOffsetY', clampOffset(b.textOffsetY - TEXT_OFFSET_STEP))}
                aria-label="Sposta testo in alto"
                title="Sposta testo in alto"
              >
                ↑
              </button>
              <button
                type="button"
                className="builder-nudge-btn nudge-left"
                onClick={() => update('textOffsetX', clampOffset(b.textOffsetX - TEXT_OFFSET_STEP))}
                aria-label="Sposta testo a sinistra"
                title="Sposta testo a sinistra"
              >
                ←
              </button>
              <button
                type="button"
                className="builder-nudge-btn nudge-center"
                onClick={() => { update('textOffsetX', 0); update('textOffsetY', 0); }}
                aria-label="Centra testo"
                title="Centra testo (azzera spostamento)"
              >
                ⟲
              </button>
              <button
                type="button"
                className="builder-nudge-btn nudge-right"
                onClick={() => update('textOffsetX', clampOffset(b.textOffsetX + TEXT_OFFSET_STEP))}
                aria-label="Sposta testo a destra"
                title="Sposta testo a destra"
              >
                →
              </button>
              <button
                type="button"
                className="builder-nudge-btn nudge-down"
                onClick={() => update('textOffsetY', clampOffset(b.textOffsetY + TEXT_OFFSET_STEP))}
                aria-label="Sposta testo in basso"
                title="Sposta testo in basso"
              >
                ↓
              </button>
            </div>
          </div>
          {b.tagline && (
            <div className="builder-field">
              <span className="builder-field-label">Posizione sottotitolo (indipendente dal titolo)</span>
              <div className="builder-nudge-grid" role="group" aria-label="Posizione sottotitolo">
                <button
                  type="button"
                  className="builder-nudge-btn nudge-up"
                  onClick={() => update('taglineOffsetY', clampOffset(b.taglineOffsetY - TEXT_OFFSET_STEP))}
                  aria-label="Sposta sottotitolo in alto"
                  title="Sposta sottotitolo in alto"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="builder-nudge-btn nudge-left"
                  onClick={() => update('taglineOffsetX', clampOffset(b.taglineOffsetX - TEXT_OFFSET_STEP))}
                  aria-label="Sposta sottotitolo a sinistra"
                  title="Sposta sottotitolo a sinistra"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="builder-nudge-btn nudge-center"
                  onClick={() => { update('taglineOffsetX', 0); update('taglineOffsetY', 0); }}
                  aria-label="Centra sottotitolo"
                  title="Centra sottotitolo (azzera spostamento)"
                >
                  ⟲
                </button>
                <button
                  type="button"
                  className="builder-nudge-btn nudge-right"
                  onClick={() => update('taglineOffsetX', clampOffset(b.taglineOffsetX + TEXT_OFFSET_STEP))}
                  aria-label="Sposta sottotitolo a destra"
                  title="Sposta sottotitolo a destra"
                >
                  →
                </button>
                <button
                  type="button"
                  className="builder-nudge-btn nudge-down"
                  onClick={() => update('taglineOffsetY', clampOffset(b.taglineOffsetY + TEXT_OFFSET_STEP))}
                  aria-label="Sposta sottotitolo in basso"
                  title="Sposta sottotitolo in basso"
                >
                  ↓
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </section>

      <aside className="builder-preview" aria-label="Anteprima logo">
        <div
          className="builder-preview-svg"
          aria-label="Anteprima logo SVG"
          role="img"
          data-logo-preview="true"
          // SECURITY: previewSvg è già passato per sanitizeSvg + builderToSvg
          // che escape caratteri XML pericolosi prima dell'output.
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
        <PreviewWatermark tier={tier} />
        {b.backgroundImage && (
          <div className="builder-ai-bg-controls">
            <span className="builder-ai-bg-badge">Background AI attivo</span>
            <button
              type="button"
              className="builder-ai-bg-regen"
              onClick={() => setShowPromptEditor((v) => !v)}
              disabled={isGeneratingBg}
              aria-label="Modifica prompt sfondo AI"
              aria-expanded={showPromptEditor}
            >
              {showPromptEditor ? 'Nascondi prompt' : 'Modifica prompt'}
            </button>
            <button
              type="button"
              className="builder-ai-bg-regen"
              onClick={handleRegenerateBackground}
              disabled={isGeneratingBg || !promptDraft.trim()}
              aria-label="Rigenera sfondo AI"
            >
              {isGeneratingBg ? 'Rigenerando…' : 'Rigenera sfondo'}
            </button>
            <button
              type="button"
              className="builder-ai-bg-remove"
              onClick={() => update('backgroundImage', null)}
              aria-label="Rimuovi background AI"
              disabled={isGeneratingBg}
            >
              Rimuovi background
            </button>
          </div>
        )}
        {b.backgroundImage && showPromptEditor && (
          <div className="builder-ai-bg-prompt-editor" aria-label="Editor prompt sfondo AI">
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value.slice(0, 600))}
              rows={4}
              placeholder="Descrivi lo sfondo che vuoi generare (es. texture geometrica tech, toni blu/teal, senza testo)"
              aria-label="Prompt sfondo AI"
            />
            <p className="builder-ai-bg-prompt-hint">
              Il prompt viene inviato a Gemini Nano Banana. Il testo e l'icona del logo restano SVG editabili e vengono
              sovrapposti allo sfondo generato. Max 600 caratteri.
            </p>
          </div>
        )}
        {b.iconType === 'lucide' && b.iconGlyph && !b.backgroundImage && (
          <div className="builder-preview-icon-meta" aria-label={`Icona ${b.iconGlyph}`} role="img">
            <PreviewIcon builder={b} />
            <span>{b.iconGlyph}</span>
          </div>
        )}
      </aside>
    </div>
  );
}
