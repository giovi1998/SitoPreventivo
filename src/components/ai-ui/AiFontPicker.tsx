import React, { useEffect, useState } from 'react';
import { ensureDocumentFonts } from '../../utils/fontLoader';

export interface FontOption {
  value: string;
  label: string;
}

/** Shared Google Fonts + system fallbacks for card, flyer, logo. */
export const SHARED_FONT_FAMILIES: readonly FontOption[] = [
  { value: 'Inter', label: 'Inter (moderno)' },
  { value: 'Roboto', label: 'Roboto (Android)' },
  { value: 'Open Sans', label: 'Open Sans (leggibile)' },
  { value: 'Lato', label: 'Lato (elegante)' },
  { value: 'Montserrat', label: 'Montserrat (geometrico)' },
  { value: 'Poppins', label: 'Poppins (arrotondato)' },
  { value: 'Source Sans 3', label: 'Source Sans 3 (chiaro)' },
  { value: 'DM Sans', label: 'DM Sans (contemporaneo)' },
  { value: 'Figtree', label: 'Figtree (moderno)' },
  { value: 'Plus Jakarta Sans', label: 'Jakarta Sans (fresco)' },
  { value: 'Oswald', label: 'Oswald (condensato)' },
  { value: 'Raleway', label: 'Raleway (elegante)' },
  { value: 'Georgia', label: 'Georgia (serif classico)' },
  { value: 'Times New Roman', label: 'Times New Roman (tradizionale)' },
  { value: 'Playfair Display', label: 'Playfair Display (premium)' },
  { value: 'Merriweather', label: 'Merriweather (leggibile serif)' },
  { value: 'Courier New', label: 'Courier New (monospace)' },
] as const;

export interface AiFontPickerProps {
  value: string;
  onChange: (font: string) => void;
  label?: string;
  className?: string;
  allowCustom?: boolean;
  fontList?: FontOption[];
  'aria-label'?: string;
  'data-testid'?: string;
}

function normalizeFont(value: string): string {
  return value.split(',')[0]?.trim() || value;
}

export function AiFontPicker({
  value,
  onChange,
  label = 'Font',
  className = '',
  allowCustom = true,
  fontList = SHARED_FONT_FAMILIES as FontOption[],
  'aria-label': ariaLabel,
  'data-testid': testId,
}: AiFontPickerProps) {
  const normalized = normalizeFont(value);
  const isKnown = fontList.some((f) => normalizeFont(f.value) === normalized || f.value === value);
  const [showCustom, setShowCustom] = useState(!isKnown && allowCustom);

  // Phase 13b (REQ-DS-005): le famiglie Google dei picker documento sono
  // caricate lazy alla prima apertura del picker, non all'avvio dell'app.
  useEffect(() => {
    ensureDocumentFonts();
  }, []);

  const selectValue = isKnown
    ? (fontList.find((f) => normalizeFont(f.value) === normalized || f.value === value)?.value ?? normalized)
    : '__custom__';

  return (
    <div className={`ai-font-picker ${className}`}>
      <label className="ai-font-picker-label">
        {label && <span className="ai-font-picker-label-text">{label}</span>}
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__custom__') {
              setShowCustom(true);
            } else {
              setShowCustom(false);
              onChange(v);
            }
          }}
          aria-label={ariaLabel || label}
          data-testid={testId}
          className="ai-font-picker-select"
        >
          {fontList.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
          {allowCustom && (
            <option value="__custom__">
              {isKnown ? 'Personalizzato…' : `Personalizzato (${value})`}
            </option>
          )}
        </select>
      </label>
      {allowCustom && showCustom && (
        <label className="ai-font-picker-custom">
          <span>Nome font</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Es. Playfair Display"
            aria-label="Nome font personalizzato"
          />
        </label>
      )}
    </div>
  );
}
