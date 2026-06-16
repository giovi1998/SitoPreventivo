import React from 'react';
import DocumentPreview from './DocumentPreview.jsx';

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

export default function EditorView({ quote, aiText, setAiText, activity, patch, updateOption, addOption, removeOption, updateClause, addClause, removeClause, runAI, deepseekKey, aiModel, setAiModel, previewRef, aiLogs }) {
  const [showAi, setShowAi] = React.useState(true);
  const [showManual, setShowManual] = React.useState(true);

  return (
    <div className="editor-grid">
      {/* AI Panel */}
      <div className={`editor-col ${showAi ? '' : 'collapsed'}`}>
        {showAi ? (
          <section className="panel ai-panel">
            <div className="panel-kicker">
              <span>Claude Design mode</span>
              <button className="panel-toggle" onClick={() => setShowAi(false)} title="Collassa pannello">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            </div>
            <h2>AI che modifica il preventivo</h2>
            <Section title="Configurazione AI" defaultOpen={!!deepseekKey}>
              <div className="api-key-section">
                <div className="ai-model-selector">
                  <label>Modello AI</label>
                  <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                  </select>
                </div>
                {deepseekKey ? (
                  <span className="api-key-status ok">● Connesso</span>
                ) : (
                  <span className="api-key-status no">● Non configurato</span>
                )}
              </div>
            </Section>
            <Section title="Prompt e azioni rapide">
              <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" placeholder="Es. Rendi il preventivo più premium, aggiungi FAQ, applica sconto 10%..." />
              <div className="ai-actions">
                <button onClick={() => runAI("premium")}>✨ Rendi premium</button>
                <button onClick={() => runAI("faq")}>❓ Aggiungi FAQ</button>
                <button onClick={() => runAI("discount")}>💰 Sconto finale</button>
                <button onClick={() => runAI("simple")}>📄 Semplifica</button>
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
        ) : (
          <div className="panel-tab" onClick={() => setShowAi(true)} title="Mostra pannello AI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>AI</span>
          </div>
        )}
      </div>

      {/* Manual Panel */}
      <div className={`editor-col ${showManual ? '' : 'collapsed'}`}>
        {showManual ? (
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
                  <label>IVA %<input type="number" value={quote.vat} onChange={(e) => patch("vat", e.target.value)} /></label>
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
              {quote.options.map((option) => (
                <div className="option-editor" key={option.id}>
                  <input value={option.title} onChange={(e) => updateOption(option.id, "title", e.target.value)} className="option-title-input" />
                  <textarea value={option.description} onChange={(e) => updateOption(option.id, "description", e.target.value)} rows={2} />
                  <div className="mini-row">
                    <label>Costo una tantum<input type="number" value={option.oneTimeCost} onChange={(e) => updateOption(option.id, "oneTimeCost", Number(e.target.value))} /></label>
                    <label>Costo mensile<input type="number" value={option.monthlyCost} onChange={(e) => updateOption(option.id, "monthlyCost", Number(e.target.value))} /></label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={option.includesMaintenance} onChange={(e) => updateOption(option.id, "includesMaintenance", e.target.checked)} />
                      Manutenzione
                    </label>
                  </div>
                  <button className="btn-remove" onClick={() => removeOption(option.id)}>Rimuovi opzione</button>
                </div>
              ))}
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
          </section>
        ) : (
          <div className="panel-tab" onClick={() => setShowManual(true)} title="Mostra pannello controllo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Man</span>
          </div>
        )}
      </div>

      {/* Preview */}
      <section className={`preview-wrap ${!showAi && !showManual ? 'full' : !showAi || !showManual ? 'wide' : ''}`} aria-label="Anteprima preventivo">
        <DocumentPreview ref={previewRef} quote={quote} />
      </section>
    </div>
  );
}
