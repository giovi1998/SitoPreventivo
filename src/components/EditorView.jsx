import React from 'react';
import DocumentPreview from './DocumentPreview.jsx';

export default function EditorView({ quote, aiText, setAiText, activity, patch, updateOption, addOption, removeOption, updateClause, addClause, removeClause, runAI, deepseekKey, setDeepseekKey, previewRef, aiLogs }) {
  return (
    <div className="editor-grid">
      {/* AI Panel */}
      <section className="panel ai-panel">
        <div className="panel-kicker">Claude Design mode</div>
        <h2>AI che modifica il preventivo</h2>

        {/* API Key input */}
        <div className="api-key-section">
          <label className="api-key-label">
            <span>DeepSeek API Key</span>
            <input type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)} placeholder="sk-..." className="api-key-input" />
          </label>
          {deepseekKey ? <span className="api-key-status ok">● Connesso</span> : <span className="api-key-status no">● Non configurato</span>}
        </div>

        <p>Scrivi una richiesta o usa un'azione rapida per modificare layout, testi, prezzi e clausole.</p>
        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" placeholder="Es. Rendi il preventivo più premium, aggiungi FAQ, applica sconto 10%..." />
        <div className="ai-actions">
          <button onClick={() => runAI("premium")}>✨ Rendi premium</button>
          <button onClick={() => runAI("faq")}>❓ Aggiungi FAQ</button>
          <button onClick={() => runAI("discount")}>💰 Sconto finale</button>
          <button onClick={() => runAI("simple")}>📄 Semplifica</button>
        </div>
          {activity && <div className="activity-log"><span>Attività</span><b>{activity}</b></div>}
          <button className="primary wide" onClick={() => runAI("custom")}>Applica prompt personalizzato</button>
        <div className="ai-log-panel">
          <span className="ai-log-title">Log AI</span>
          {aiLogs.length === 0 && <div className="ai-log-entry empty">Nessuna attività ancora...</div>}
          {aiLogs.map((log, i) => (
            <div key={i} className={`ai-log-entry ${log.type}`}>
              <span className="ai-log-time">{log.time}</span> {log.msg}
            </div>
          ))}
        </div>
      </section>

      {/* Manual controls */}
      <section className="panel manual-panel" aria-labelledby="manual-title">
        <div className="panel-kicker">Controllo manuale</div>
        <h2 id="manual-title">Dati preventivo</h2>

        <div className="stack">
          <div className="form-grid">
            <label>Titolo preventivo<input value={quote.title} onChange={(e) => patch("title", e.target.value)} /></label>
            <label>Cliente<input value={quote.client} onChange={(e) => patch("client", e.target.value)} /></label>
            <label>Data<input value={quote.date} onChange={(e) => patch("date", e.target.value)} /></label>
            <label>IVA %<input type="number" value={quote.vat} onChange={(e) => patch("vat", e.target.value)} /></label>
          </div>
          <label>Introduzione<textarea value={quote.intro} onChange={(e) => patch("intro", e.target.value)} rows={3} /></label>
        </div>

        <div className="control-block">
          <div className="section-head"><h3>10 colori brand</h3></div>
          <div className="swatches">
            {["#0B57D0","#11845B","#6D3FD1","#A66200","#D64545","#B83280","#0F766E","#334155","#4F46E5","#5B7F22"].map(c => (
              <button key={c} className={quote.color === c ? "selected" : ""} style={{ background: c }} onClick={() => patch("color", c)} aria-label={c} />
            ))}
          </div>
        </div>

        <div className="control-block">
          <div className="section-head"><h3>Opzioni commerciali</h3><button onClick={addOption}>+ Opzione</button></div>
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
        </div>

        <div className="control-block">
          <div className="section-head"><h3>Clausole e condizioni</h3><button onClick={addClause}>+ Clausola</button></div>
          {quote.clauses.map((clause) => (
            <div className="clause-editor" key={clause.id}>
              <input value={clause.title} onChange={(e) => updateClause(clause.id, "title", e.target.value)} />
              <textarea value={clause.body} onChange={(e) => updateClause(clause.id, "body", e.target.value)} rows={2} />
              <button className="btn-remove" onClick={() => removeClause(clause.id)}>Rimuovi</button>
            </div>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="preview-wrap" aria-label="Anteprima preventivo">
        <DocumentPreview ref={previewRef} quote={quote} />
      </section>
    </div>
  );
}
