import React from 'react';
import DocumentPreview from './DocumentPreview.jsx';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Section({ title, defaultOpen = true, children, extra }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <div className="collapsible-head" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <div className="collapsible-head-right">
          {extra}
          <svg className="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function SortableOption({ option, updateOption, removeOption }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div className="option-editor" ref={setNodeRef} style={style}>
      <div className="option-drag-handle" {...attributes} {...listeners} title="Trascina per riordinare">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <input value={option.title} onChange={(e) => updateOption(option.id, "title", e.target.value)} className="option-title-input" />
      <textarea value={option.description} onChange={(e) => updateOption(option.id, "description", e.target.value)} rows={2} />
      <div className="mini-row">
        <label>Costo una tantum<input type="number" inputMode="numeric" value={option.oneTimeCost} onChange={(e) => updateOption(option.id, "oneTimeCost", Number(e.target.value))} /></label>
        <label>Costo mensile<input type="number" inputMode="numeric" value={option.monthlyCost} onChange={(e) => updateOption(option.id, "monthlyCost", Number(e.target.value))} /></label>
        <label className="checkbox-label">
          <input type="checkbox" checked={option.includesMaintenance} onChange={(e) => updateOption(option.id, "includesMaintenance", e.target.checked)} />
          Manutenzione
        </label>
      </div>
      <button className="btn-remove" onClick={() => removeOption(option.id)}>Rimuovi opzione</button>
    </div>
  );
}

export default function EditorView({ quote, aiText, setAiText, activity, patch, updateOption, addOption, removeOption, updateOptions, updateClause, addClause, removeClause, runAI, aiModel, setAiModel, previewRef, aiLogs, isDirty, saveQuote, shareInfo, toggleShare }) {
  const [showAi, setShowAi] = React.useState(true);
  const [showManual, setShowManual] = React.useState(true);
  const [mobileTab, setMobileTab] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty) saveQuote();
    }, 30000);
    return () => clearInterval(timer);
  }, [isDirty, saveQuote]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = quote.options.findIndex(o => o.id === active.id);
    const newIndex = quote.options.findIndex(o => o.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      updateOptions(arrayMove(quote.options, oldIndex, newIndex));
    }
  };

  const copyShareLink = () => {
    if (shareInfo?.link) {
      navigator.clipboard.writeText(shareInfo.link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const aiPanel = (
    <section className="panel ai-panel">
      <div className="panel-kicker">
        <span>Claude Design mode</span>
        <button className="panel-toggle" onClick={() => setShowAi(false)} title="Collassa pannello">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
      <h2>AI che modifica il preventivo</h2>
      <Section title="Configurazione AI" defaultOpen={true}>
        <div className="api-key-section">
          <div className="ai-model-selector">
            <label>Modello AI</label>
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
              <option value="deepseek-chat">DeepSeek Chat</option>
            </select>
          </div>
          <span className="api-key-status ok">● Chiave via server (env var)</span>
        </div>
      </Section>
      <Section title="Prompt e azioni rapide">
        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" placeholder="Es. Rendi il preventivo più premium, aggiungi FAQ, applica sconto 10%..." />
        <div className="ai-actions">
          <button onClick={() => runAI("premium")}>Rendi premium</button>
          <button onClick={() => runAI("faq")}>Aggiungi FAQ</button>
          <button onClick={() => runAI("discount")}>Sconto finale</button>
          <button onClick={() => runAI("simple")}>Semplifica</button>
        </div>
        {activity && <div className="activity-log"><span>Attività</span><b>{activity}</b></div>}
        <button className="primary wide" onClick={() => runAI("custom")}>Applica prompt personalizzato</button>
      </Section>
      <Section title="Log AI" defaultOpen={false}>
        <div className="ai-log-panel" style={{ border: 'none', padding: 0, margin: 0 }}>
          {aiLogs.length === 0 && <div className="ai-log-entry empty">Nessuna attività ancora...</div>}
          {aiLogs.map((log, i) => (
            <div key={i} className={`ai-log-entry ${log.type}`}>
              <span className="ai-log-time">{log.time}</span> {log.msg}
            </div>
          ))}
        </div>
      </Section>
    </section>
  );

  const manualPanel = (
    <section className="panel manual-panel" aria-labelledby="manual-title">
      <div className="panel-kicker">
        <span>Controllo manuale</span>
        <button className="panel-toggle" onClick={() => setShowManual(false)} title="Collassa pannello">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
      <h2 id="manual-title">Dati preventivo</h2>
      <Section title="Informazioni base">
        <div className="stack">
          <div className="form-grid">
            <label>Titolo preventivo<input value={quote.title} onChange={(e) => patch("title", e.target.value)} /></label>
            <label>Cliente<input value={quote.client} onChange={(e) => patch("client", e.target.value)} /></label>
            <label>Data<input value={quote.date} onChange={(e) => patch("date", e.target.value)} /></label>
            <label>IVA %<input type="number" inputMode="numeric" value={quote.vat} onChange={(e) => patch("vat", e.target.value)} /></label>
          </div>
          <label>Introduzione<textarea value={quote.intro} onChange={(e) => patch("intro", e.target.value)} rows={3} /></label>
        </div>
      </Section>
      <Section title="Colori brand">
        <div className="swatches">
          {["#0B57D0","#11845B","#6D3FD1","#A66200","#D64545","#B83280","#0F766E","#334155","#4F46E5","#5B7F22"].map(c => (
            <button key={c} className={quote.color === c ? "selected" : ""} style={{ background: c }} onClick={() => patch("color", c)} aria-label={c} />
          ))}
        </div>
      </Section>
      <Section title="Opzioni commerciali" extra={<button onClick={addOption} className="btn-add">+ Opzione</button>}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={quote.options.map(o => o.id)} strategy={verticalListSortingStrategy}>
            {quote.options.map((option) => (
              <SortableOption key={option.id} option={option} updateOption={updateOption} removeOption={removeOption} />
            ))}
          </SortableContext>
        </DndContext>
      </Section>
      <Section title="Clausole e condizioni" extra={<button onClick={addClause} className="btn-add">+ Clausola</button>}>
        {quote.clauses.map((clause) => (
          <div className="clause-editor" key={clause.id}>
            <input value={clause.title} onChange={(e) => updateClause(clause.id, "title", e.target.value)} />
            <textarea value={clause.body} onChange={(e) => updateClause(clause.id, "body", e.target.value)} rows={2} />
            <button className="btn-remove" onClick={() => removeClause(clause.id)}>Rimuovi</button>
          </div>
        ))}
      </Section>
      <Section title="Condivisione">
        <div className="share-section">
          <label className="checkbox-label" style={{ marginBottom: '12px' }}>
            <input type="checkbox" checked={quote.isShared || false} onChange={(e) => toggleShare(e.target.checked)} />
            Condividi link pubblico
          </label>
          {quote.isShared && shareInfo?.link && (
            <div className="share-link-row">
              <input type="text" readOnly value={shareInfo.link} style={{ flex: 1, fontSize: '.8rem', fontFamily: 'monospace' }} onClick={(e) => e.target.select()} />
              <button onClick={copyShareLink} style={{ padding: '8px 14px', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                {copied ? 'Copiato!' : 'Copia'}
              </button>
            </div>
          )}
        </div>
      </Section>
    </section>
  );

  return (
    <div className="editor-grid">
      {/* Desktop panels */}
      <div className={`editor-col ${showAi ? '' : 'collapsed'}`}>
        {showAi ? aiPanel : (
          <div className="panel-tab" onClick={() => setShowAi(true)} title="Mostra pannello AI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>AI</span>
          </div>
        )}
      </div>

      <div className={`editor-col ${showManual ? '' : 'collapsed'}`}>
        {showManual ? manualPanel : (
          <div className="panel-tab" onClick={() => setShowManual(true)} title="Mostra pannello controllo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Man</span>
          </div>
        )}
      </div>

      {/* Mobile inline tabs */}
      <div className="editor-mobile-bar">
        <button className={mobileTab === 'ai' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'ai' ? null : 'ai')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>
          AI
        </button>
        <button className={mobileTab === 'manual' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'manual' ? null : 'manual')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Manuale
        </button>
      </div>

      {/* Mobile inline panel */}
      {mobileTab && (
        <div className="editor-mobile-panel">
          {mobileTab === 'ai' ? aiPanel : manualPanel}
        </div>
      )}

      {/* Preview */}
      <section className={`preview-wrap ${!showAi && !showManual ? 'full' : !showAi || !showManual ? 'wide' : ''}`} aria-label="Anteprima preventivo">
        <DocumentPreview ref={previewRef} quote={quote} />
      </section>
    </div>
  );
}
