import React from 'react';
import Icon from './Icon.jsx';
import DocumentPreview from './DocumentPreview.jsx';
import AuthorQuoteTemplate from './AuthorQuoteTemplate.jsx';
import { COLORS, STYLES, sectionLibrary } from '../constants.js';

export default function EditorView(props) {
  const { quote, totals, aiText, setAiText, activity, patch, updateItem, removeItem, addItem, updateSection, removeSection, addSection, runAI } = props;
  return (
    <div className="editor-grid">
      <section className="panel ai-panel" aria-labelledby="ai-title">
        <div className="panel-kicker">Claude Design mode</div>
        <h2 id="ai-title">AI che modifica il preventivo</h2>
        <p>Scrivi una richiesta o usa un'azione rapida: l'AI cambia contenuti, stile, sezioni, colore e prezzi in modo visibile.</p>
        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" />
        <div className="ai-actions">
          <button onClick={() => runAI('premium')}>Rendi premium</button>
          <button onClick={() => runAI('timeline')}>Aggiungi timeline</button>
          <button onClick={() => runAI('compact')}>Compatta</button>
          <button onClick={() => runAI('discount')}>Sconto finale</button>
          <button onClick={() => runAI('legal')}>Condizioni</button>
        </div>
        <button className="primary wide" onClick={() => runAI('custom')}><Icon name="spark" />Applica prompt AI</button>
        <div className="activity-log"><span>Ultima azione</span><b>{activity}</b></div>
      </section>

      <section className="panel manual-panel" aria-labelledby="manual-title">
        <div className="panel-kicker">Controllo manuale completo</div>
        <h2 id="manual-title">Campi, box, stile e prezzi</h2>
        <ManualFields quote={quote} patch={patch} />
        <PresetControls quote={quote} patch={patch} />
        <LineItems quote={quote} updateItem={updateItem} removeItem={removeItem} addItem={addItem} />
        <SectionInspector quote={quote} updateSection={updateSection} removeSection={removeSection} addSection={addSection} />
      </section>

      <section className="preview-wrap" aria-label="Anteprima preventivo">
        {quote.template === 'autore' ? <AuthorQuoteTemplate client={quote.client} date={quote.date} styleId={quote.styleId} /> : <DocumentPreview quote={quote} totals={totals} />}
      </section>
    </div>
  );
}

function ManualFields({ quote, patch }) {
  return (
    <div className="stack editor-block">
      <div className="form-grid">
        <label>Titolo preventivo<input value={quote.title} onChange={(e) => patch('title', e.target.value)} /></label>
        <label>Cliente<input value={quote.client} onChange={(e) => patch('client', e.target.value)} /></label>
        <label>Referente<input value={quote.contact} onChange={(e) => patch('contact', e.target.value)} /></label>
        <label>IVA %<input type="number" value={quote.vat} onChange={(e) => patch('vat', e.target.value)} /></label>
      </div>
      <label>Introduzione<textarea value={quote.intro} onChange={(e) => patch('intro', e.target.value)} /></label>
      <label>Note finali<textarea value={quote.note} onChange={(e) => patch('note', e.target.value)} /></label>
      <label>Template documento<select value={quote.template} onChange={(e) => patch('template', e.target.value)}><option value="standard">Preventivo custom</option><option value="autore">Template autrice/sito web</option></select></label>
    </div>
  );
}

function PresetControls({ quote, patch }) {
  return (
    <div className="editor-block">
      <h3>10 colori brand</h3>
      <div className="swatches">{COLORS.map((color) => <button key={color.value} className={quote.color === color.value ? 'selected' : ''} style={{ '--swatch': color.value }} onClick={() => patch('color', color.value)} aria-label={color.name} />)}</div>
      <h3>10 stili documento</h3>
      <div className="style-grid">{STYLES.map((style) => <button key={style.id} className={quote.styleId === style.id ? 'selected' : ''} onClick={() => { patch('styleId', style.id); patch('style', style.name); }}>{style.name}</button>)}</div>
    </div>
  );
}

function LineItems({ quote, updateItem, removeItem, addItem }) {
  return (
    <div className="editor-block">
      <div className="block-head"><h3>Voci economiche</h3><button onClick={addItem}>+ voce</button></div>
      <div className="items-editor">{quote.items.map((item) => (
        <div className="item-editor" key={item.id}>
          <input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} aria-label="Descrizione voce" />
          <textarea value={item.detail} onChange={(e) => updateItem(item.id, 'detail', e.target.value)} aria-label="Dettaglio voce" />
          <div className="mini-grid"><label>Qtà<input type="number" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} /></label><label>Prezzo<input type="number" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} /></label><button onClick={() => removeItem(item.id)}>Elimina</button></div>
        </div>
      ))}</div>
    </div>
  );
}

function SectionInspector({ quote, updateSection, removeSection, addSection }) {
  return (
    <div className="editor-block">
      <div className="block-head"><h3>Box e sezioni</h3><span>{quote.sections.length} attive</span></div>
      <div className="section-library">{sectionLibrary.map((title) => <button key={title} onClick={() => addSection(title)}>+ {title}</button>)}</div>
      <div className="section-list">{quote.sections.map((section) => (
        <div className="section-edit" key={section.id}>
          <input value={section.title} onChange={(e) => updateSection(section.id, 'title', e.target.value)} aria-label="Titolo sezione" />
          <textarea value={section.body} onChange={(e) => updateSection(section.id, 'body', e.target.value)} aria-label="Testo sezione" />
          <button onClick={() => removeSection(section.id)}>Rimuovi box</button>
        </div>
      ))}</div>
    </div>
  );
}
