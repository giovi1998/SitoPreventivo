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

interface BuilderPanelProps {
  logo: Logo;
  onPatch: (path: string, value: any) => void;
  onTemplate?: (sector: LogoSector) => void;
  tier?: Tier;
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

const FONT_OPTIONS = ['Inter', 'Georgia', 'system-ui', 'serif', 'sans-serif'];
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

export default function BuilderPanel({ logo, onPatch, onTemplate, tier = 'unlocked' }: BuilderPanelProps) {
  const b = logo.builder;
  const [search, setSearch] = useState('');
  const debouncedBuilder = useDebouncedValue(b, 200);

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
          <label className="builder-field">
            <span>Font</span>
            <select
              value={b.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              aria-label="Font"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
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
      </section>

      <aside className="builder-preview" aria-label="Anteprima logo">
        <div
          className="builder-preview-svg"
          aria-label="Anteprima logo SVG"
          role="img"
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
              className="builder-ai-bg-remove"
              onClick={() => update('backgroundImage', null)}
              aria-label="Rimuovi background AI"
            >
              Rimuovi background
            </button>
          </div>
        )}
        {b.iconType === 'lucide' && b.iconGlyph && (
          <div className="builder-preview-icon-meta" aria-hidden="true">
            <PreviewIcon builder={b} />
            <span>{b.iconGlyph}</span>
          </div>
        )}
      </aside>
    </div>
  );
}
