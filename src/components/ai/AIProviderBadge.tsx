import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { providerRegistry } from '../../ai/providers/registry';
import {
  getAiProviderDefault,
  setAiProviderDefault,
  getAiReasoningEffort,
  setAiReasoningEffort,
} from '../../utils/uiPrefs';
import { formatCostUsd, getPricingLabel, OLLAMA_PRO_FLAT_MONTHLY, PRICING } from '../../ai/providerPricing';
import './AIProviderBadge.css';

/**
 * Badge provider uniforme (Phase 14, REQ-AI-006 + TB-023 REQ-UX-002).
 * Unica dicitura provider in tutta l'app: footer AI Console e pannelli AI.
 *
 * TB-023: diventa dropdown cliccabile per switch provider. Mostra:
 * - Provider attivo (DeepSeek/Ollama/Gemini)
 * - Costo ultima operazione (se passato via prop `lastCostUsd`)
 * - Lista provider disponibili con pricing label
 * - Click-outside + ESC chiudono
 */
export interface AIProviderBadgeProps {
  /** Costo USD ultima operazione AI (opzionale, mostrato inline) */
  lastCostUsd?: number;
  /** Costo USD totale accumulato di sessione (TB-023 REQ-UX-006 tooltip) */
  totalCostUsd?: number;
  /** Callback quando l'utente cambia provider */
  onProviderChange?: (providerId: string) => void;
}

export function providerShortName(id: string): string {
  if (id.startsWith('ollama-')) return 'Ollama';
  if (id.startsWith('gemini-')) return 'Gemini';
  return 'DeepSeek';
}

export function providerModelShort(model: string): string {
  return model
    .replace('minimax-m3:cloud', 'MiniMax M3')
    .replace('deepseek-v4-flash:cloud', 'V4 Flash')
    .replace('deepseek-v4-flash:0731-cloud', 'V4 Flash 0731')
    .replace('deepseek-v4-pro:cloud', 'V4 Pro')
    .replace('qwen-3.5', 'Qwen 3.5')
    .replace('deepseek-v4-flash', 'V4 Flash')
    .replace('gemini-2.0-flash-preview-image-generation', 'Flash Image')
    .replace('gemini-3.1-flash-image', 'Nano Banana');
}

export default function AIProviderBadge({
  lastCostUsd,
  totalCostUsd,
  onProviderChange,
}: AIProviderBadgeProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipTimer = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    () => getAiProviderDefault() || providerRegistry.getDefaultId()
  );
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'high' | 'max'>(
    () => getAiReasoningEffort()
  );
  const ref = useRef<HTMLDivElement>(null);

  const providers = providerRegistry.listProviders();
  const selected = providers.find((p) => p.id === selectedId) || providers[0];

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setAiProviderDefault(id);
      onProviderChange?.(id);
      setOpen(false);
    },
    [onProviderChange]
  );

  const groupedProviders = useMemo(() => {
    const groups: Record<string, typeof providers> = {};
    for (const p of providers) {
      const family = providerShortName(p.id).toLowerCase();
      groups[family] = groups[family] || [];
      groups[family].push(p);
    }
    return groups;
  }, [providers]);

  // Click-outside chiude
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ESC chiude
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // TB-023 REQ-UX-006: tooltip costi 30gg appare dopo hover ≥300ms.
  const showTooltip = useCallback(() => {
    if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
    tooltipTimer.current = window.setTimeout(() => setTooltipOpen(true), 300);
  }, []);
  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) {
      window.clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltipOpen(false);
  }, []);
  useEffect(() => () => {
    if (tooltipTimer.current) window.clearTimeout(tooltipTimer.current);
  }, []);

  const shortLabel = selected ? providerShortName(selected.id) : 'AI';
  const modelLabel = selected ? providerModelShort(selected.model) : '';

  // Per provider flat (Ollama Pro) non mostriamo il costo dell'ultima
  // operazione: quella potrebbe essere di un altro provider. Mostriamo
  // invece "flat" o $0 a seconda del contesto.
  const pricing = selected ? PRICING[selected.id] : undefined;
  const isFlat = pricing?.unit === 'flat_monthly';
  const showCost = lastCostUsd !== undefined && lastCostUsd >= 0 && !isFlat;
  // TB-023 REQ-UX-006: breakdown costi solo se c'è un total > 0.
  const showTotalTooltip = totalCostUsd !== undefined && totalCostUsd > 0;

  return (
    <div className="ai-provider-badge-wrapper" ref={ref}>
      <button
        type="button"
        className="ai-provider-badge"
        data-testid="ai-provider-badge"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={showTotalTooltip ? showTooltip : undefined}
        onMouseLeave={showTotalTooltip ? hideTooltip : undefined}
        onFocus={showTotalTooltip ? showTooltip : undefined}
        onBlur={showTotalTooltip ? hideTooltip : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Cambia provider AI"
      >
        <span className="ai-provider-badge__dot" aria-hidden="true" />
        <span className="ai-provider-badge__label">
          <span className="ai-provider-badge__provider">{shortLabel}</span>
          {showCost && (
            <span className="ai-provider-badge__cost" aria-label={`Costo ultima operazione ${formatCostUsd(lastCostUsd)}`}>
              {formatCostUsd(lastCostUsd)}
            </span>
          )}
        </span>
        <span className={`ai-provider-badge__chevron ${open ? 'ai-provider-badge__chevron--open' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="ai-provider-badge__menu" role="listbox" data-testid="ai-provider-menu">
          <div className="ai-provider-badge__menu-header">Provider AI</div>
          {Object.entries(groupedProviders).map(([family, group]) => (
            <div key={family} className="ai-provider-badge__family">
              {group.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ai-provider-badge__option ${p.id === selectedId ? 'is-selected' : ''}`}
                  role="option"
                  aria-selected={p.id === selectedId}
                  onClick={() => handleSelect(p.id)}
                >
                  <div className="ai-provider-badge__option-left">
                    <span className="ai-provider-badge__option-name">
                      {providerShortName(p.id)}
                    </span>
                    <span className="ai-provider-badge__option-model">
                      {providerModelShort(p.model)}
                    </span>
                  </div>
                  <div className="ai-provider-badge__option-right">
                    {p.supportsVision && (
                      <span className="ai-provider-badge__option-tag" title="Multimodale (vision)">
                        vision
                      </span>
                    )}
                    <span className="ai-provider-badge__option-price">{getPricingLabel(p.id)}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
          <div className="ai-provider-badge__menu-footer">
            <div className="ai-provider-badge__effort">
              <span className="ai-provider-badge__effort-label">Ragionamento</span>
              <div className="ai-provider-badge__effort-options">
                {(['low', 'high', 'max'] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`ai-provider-badge__effort-btn ${e === reasoningEffort ? 'is-selected' : ''}`}
                    onClick={() => { setReasoningEffort(e); setAiReasoningEffort(e); }}
                  >
                    {e === 'low' ? 'Veloce' : e === 'high' ? 'Profondo' : 'Massimo'}
                  </button>
                ))}
              </div>
            </div>
            <div className="ai-provider-badge__menu-footer-note">
              Ollama Pro: ${OLLAMA_PRO_FLAT_MONTHLY}/mese flat · 50x free usage
            </div>
          </div>
        </div>
      )}

      {tooltipOpen && showTotalTooltip && (
        <div
          className="ai-provider-badge__tooltip"
          role="tooltip"
          data-testid="ai-provider-cost-tooltip"
        >
          <div className="ai-provider-badge__tooltip-title">Costi AI sessione</div>
          <div className="ai-provider-badge__tooltip-row">
            <span>Totale sessione</span>
            <span>{formatCostUsd(totalCostUsd)}</span>
          </div>
          <div className="ai-provider-badge__tooltip-hint">
            Breakdown per-provider 30gg disponibile in Admin → Cost breakdown.
          </div>
        </div>
      )}
    </div>
  );
}