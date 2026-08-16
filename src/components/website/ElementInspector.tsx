import React, { useState } from 'react';
import type { ElementContext } from '../../utils/website/elementPicker';

interface ElementInspectorProps {
  context: ElementContext;
  onRemove: () => void;
}

const MAX_HTML = 600;
const MAX_RULES = 5;

/**
 * Pannello ispezione di un elemento selezionato: HTML, regole CSS che lo
 * toccano, regole di elementi simili, variabili CSS e computed style.
 * Collassabile per tenere compatta la lista multi-selezione.
 */
export default function ElementInspector({ context, onRemove }: ElementInspectorProps) {
  const [expanded, setExpanded] = useState(false);

  const htmlPreview = context.html.length > MAX_HTML ? context.html.slice(0, MAX_HTML) + '…' : context.html;
  const rules = context.cssRules.slice(0, MAX_RULES);
  const similar = context.similarRules.slice(0, MAX_RULES);
  const cssVars = Object.entries(context.computed).filter(([p]) => p.startsWith('--'));
  const computedEntries = Object.entries(context.computed).filter(([p]) => !p.startsWith('--'));

  return (
    <div className="element-inspector__item">
      <div className="element-inspector__item-header">
        <button type="button" className="element-inspector__toggle" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? '▾' : '▸'}
        </button>
        <span className="element-inspector__page">{context.page}</span>
        <span className="element-inspector__page">{context.viewport}</span>
        <button type="button" className="element-inspector__close" onClick={onRemove} aria-label="Rimuovi elemento">✕</button>
      </div>
      <pre className="element-inspector__code">{htmlPreview}</pre>

      {expanded && (
        <>
          {rules.length > 0 && (
            <div className="element-inspector__section">
              <div className="element-inspector__label">CSS che lo tocca</div>
              <pre className="element-inspector__code">{rules.join('\n')}</pre>
            </div>
          )}
          {similar.length > 0 && (
            <div className="element-inspector__section">
              <div className="element-inspector__label">CSS di elementi simili</div>
              <pre className="element-inspector__code">{similar.join('\n')}</pre>
            </div>
          )}
          {cssVars.length > 0 && (
            <div className="element-inspector__section">
              <div className="element-inspector__label">Variabili CSS</div>
              <div className="element-inspector__computed">
                {cssVars.map(([prop, value]) => (
                  <div key={prop} className="element-inspector__computed-row">
                    <span className="element-inspector__computed-prop">{prop}</span>
                    <span className="element-inspector__computed-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {computedEntries.length > 0 && (
            <div className="element-inspector__section">
              <div className="element-inspector__label">Stile calcolato</div>
              <div className="element-inspector__computed">
                {computedEntries.slice(0, 12).map(([prop, value]) => (
                  <div key={prop} className="element-inspector__computed-row">
                    <span className="element-inspector__computed-prop">{prop}</span>
                    <span className="element-inspector__computed-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
