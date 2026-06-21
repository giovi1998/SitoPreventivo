import React from 'react';
import DocumentPreview from './DocumentPreview';
import AILogPanel from './AILogPanel';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PremiumQuote, DocumentTemplateId, QuoteOption } from '../utils/quoteSchema';
import { getTheme } from '../utils/documentThemes';

function Section({ title, defaultOpen = false, children, extra, badge }: { title: string; defaultOpen?: boolean; children: React.ReactNode; extra?: React.ReactNode; badge?: string | number }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <div className="collapsible-head" onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); }}}>
        <span className="collapsible-title">
          {title}
          {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
        </span>
        <div className="collapsible-head-right">
          {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
          <svg className="collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function SortableOption({ option, updateOption, removeOption }: {
  option: QuoteOption;
  updateOption: (id: string, key: string, value: any) => void;
  removeOption: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 'auto',
  };

  const fixedItem = option.items.find((i) => i.unit === 'fixed');
  const monthlyItem = option.items.find((i) => i.unit === 'month');
  const hasMaintenance = option.items.some((i) => i.label.toLowerCase().includes('manutenzione'));

  return (
    <div className="option-editor" ref={setNodeRef} style={style}>
      <div className="option-drag-handle" {...attributes} {...listeners} title="Trascina per riordinare">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
      <input value={option.label} onChange={(e) => updateOption(option.id, "title", e.target.value)} className="option-title-input" />
      <textarea value={option.description} onChange={(e) => updateOption(option.id, "description", e.target.value)} rows={2} />
      <div className="mini-row">
        <label>Costo una tantum
          <input type="number" inputMode="numeric" value={fixedItem?.unitPrice || 0} onChange={(e) => updateOption(option.id, "oneTimeCost", Number(e.target.value))} />
        </label>
        <label>Costo mensile
          <input type="number" inputMode="numeric" value={monthlyItem?.unitPrice || 0} onChange={(e) => updateOption(option.id, "monthlyCost", Number(e.target.value))} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={hasMaintenance} onChange={(e) => updateOption(option.id, "includesMaintenance", e.target.checked)} />
          Manutenzione
        </label>
      </div>
      <button className="btn-remove" onClick={() => removeOption(option.id)}>Rimuovi opzione</button>
    </div>
  );
}

interface EditorViewProps {
  quote: PremiumQuote;
  aiText: string;
  setAiText: (t: string) => void;
  patch: (key: string, value: any) => void;
  updateOption: (id: string, key: string, value: any) => void;
  addOption: () => void;
  removeOption: (id: string) => void;
  updateOptions: (opts: any[]) => void;
  updateClause: (id: string, key: string, value: string) => void;
  addClause: () => void;
  removeClause: (id: string) => void;
  onRunAI: (mode?: string) => void;
  aiModel: string;
  onAiModelChange: (m: string) => void;
  previewRef: React.Ref<HTMLElement>;
  aiLogs: any[];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
  onResetChat: () => void;
  isDirty: boolean;
  saveQuote: (opts?: { title?: string; silent?: boolean } | string) => void;
  documentTheme?: DocumentTemplateId;
  onSave: () => void;
  onExportPDF: () => void;
  onExportDOCX?: () => void;
  onImportPDF?: () => void;
  onSaveAsTemplate?: () => void;
  lastSaveTime: Date | null;
  pdfLoading: boolean;
  docxLoading?: boolean;
}

export default function EditorView({
  quote, aiText, setAiText, patch, updateOption, addOption, removeOption,
  updateOptions, updateClause, addClause, removeClause, onRunAI, aiModel, onAiModelChange,
  previewRef, aiLogs, isProcessing, availableModels, onResetChat,
  isDirty, saveQuote, documentTheme = 'corporate',
  onSave, onExportPDF, onExportDOCX, onImportPDF, onSaveAsTemplate,
  lastSaveTime, pdfLoading, docxLoading,
}: EditorViewProps) {
  const [showAi, setShowAi] = React.useState(true);
  const [showManual, setShowManual] = React.useState(true);
  const [mobileTab, setMobileTab] = React.useState<string | null>(null);
  const [previewFocus, setPreviewFocus] = React.useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const saveRef = React.useRef(saveQuote);
  const dirtyRef = React.useRef(isDirty);
  const processingRef = React.useRef(isProcessing);
  const cooldownRef = React.useRef(0);
  const prevProcessingRef = React.useRef(isProcessing);
  saveRef.current = saveQuote;
  dirtyRef.current = isDirty;
  processingRef.current = isProcessing;

  React.useEffect(() => {
    if (prevProcessingRef.current && !isProcessing) {
      cooldownRef.current = Date.now() + 5000;
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!dirtyRef.current) return;
      if (processingRef.current) return;
      if (Date.now() < cooldownRef.current) return;
      saveRef.current({ silent: true });
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = quote.options.findIndex((o) => o.id === active.id);
    const newIndex = quote.options.findIndex((o) => o.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      updateOptions(arrayMove(quote.options, oldIndex, newIndex));
    }
  };

  const theme = getTheme(documentTheme);

  const themeSelector = (
    <Section title="Tema documento" defaultOpen={false}>
      <div className="theme-selector">
        {(['minimal', 'corporate', 'creative'] as DocumentTemplateId[]).map((tid) => {
          const t = getTheme(tid);
          const previewClass = `theme-preview-${tid}`;
          return (
            <div
              key={tid}
              className={`theme-card ${documentTheme === tid ? 'selected' : ''}`}
              onClick={() => patch('documentTheme', tid)}
            >
              <div className={`theme-preview ${previewClass}`}>
                {t.label}
              </div>
              <div className="theme-name">{t.label}</div>
              <div className="theme-desc">{t.description}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );

  const aiPanel = (
    <section className="panel ai-panel">
      <div className="panel-kicker">
        <span>AI Design Mode</span>
        <button className="panel-toggle" onClick={() => setShowAi(false)} title="Collassa pannello" aria-label="Collassa AI">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
      <h2>AI che modifica il preventivo</h2>
      <Section title="Configurazione AI" defaultOpen={true}>
        <div className="api-key-section">
          <div className="ai-model-selector">
            <label>Modello AI</label>
            <select value={aiModel} onChange={(e) => onAiModelChange(e.target.value)}>
              {availableModels.length > 0 ? availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.model}</option>
              )) : (
                <option value="deepseek-chat">DeepSeek Chat</option>
              )}
            </select>
          </div>
          <span className="api-key-status ok">● Chiave via server (env var)</span>
        </div>
      </Section>
      <Section title="Prompt e azioni rapide" defaultOpen={true}>
        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" placeholder="Es. Rendi il preventivo più premium, aggiungi FAQ, applica sconto 10%..." />
        <div className="ai-actions">
          <button onClick={() => onRunAI("premium")}>Rendi premium</button>
          <button onClick={() => onRunAI("faq")}>Aggiungi FAQ</button>
          <button onClick={() => onRunAI("discount")}>Sconto finale</button>
          <button onClick={() => onRunAI("simple")}>Semplifica</button>
        </div>
        <div className="ai-extra-actions">
          <button className="primary wide" onClick={() => onRunAI("custom")} disabled={isProcessing}>
            {isProcessing ? 'Elaborazione...' : 'Applica prompt personalizzato'}
          </button>
          <button className="btn-ghost" onClick={onResetChat} style={{ width: '100%', marginTop: '4px', fontSize: '.75rem' }}>
            Nuova conversazione
          </button>
        </div>
      </Section>
      <Section title="Log AI" defaultOpen={true}>
        <AILogPanel logs={aiLogs} isProcessing={isProcessing} />
      </Section>
    </section>
  );

  const manualPanel = (
    <section className="panel manual-panel" aria-labelledby="manual-title">
      <div className="panel-kicker">
        <span>Controllo manuale</span>
        <button className="panel-toggle" onClick={() => setShowManual(false)} title="Collassa pannello" aria-label="Collassa Manuale">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
      <h2 id="manual-title">Dati preventivo</h2>
      {themeSelector}
      <Section title="Informazioni base" defaultOpen={true}>
        <div className="stack">
          <div className="form-grid">
            <label>Titolo preventivo
              <input value={quote.project?.title || ''} onChange={(e) => patch("title", e.target.value)} />
            </label>
            <label>Cliente
              <input value={quote.client?.name || ''} onChange={(e) => patch("client", e.target.value)} />
            </label>
            <label>Data
              <input value={(quote.createdAt || '').slice(0, 10)} onChange={(e) => patch("date", e.target.value)} />
            </label>
            <label>IVA %
              <input type="number" inputMode="numeric" value={quote.options[0]?.items[0]?.tax?.rate || 22} onChange={(e) => patch("vat", e.target.value)} />
            </label>
          </div>
          <label>Introduzione
            <textarea value={quote.project?.description || ''} onChange={(e) => patch("intro", e.target.value)} rows={3} />
          </label>
        </div>
      </Section>
      <Section title="Colori brand" defaultOpen={false}>
        <div className="swatches">
          {["#0B57D0","#11845B","#6D3FD1","#A66200","#D64545","#B83280","#0F766E","#334155","#4F46E5","#5B7F22"].map((c) => (
            <button key={c} className={quote.uiPreferences?.accentColor === c ? "selected" : ""} style={{ background: c }} onClick={() => patch("color", c)} aria-label={c} />
          ))}
        </div>
      </Section>
      <Section title="Opzioni commerciali" badge={quote.options.length} defaultOpen={quote.options.length <= 2} extra={<button onClick={addOption} className="btn-add">+ Opzione</button>}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={quote.options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {quote.options.map((option) => (
              <SortableOption key={option.id} option={option} updateOption={updateOption} removeOption={removeOption} />
            ))}
          </SortableContext>
        </DndContext>
      </Section>
      <Section title="Clausole e condizioni" badge={quote.legalClauses?.length || 0} defaultOpen={false} extra={<button onClick={addClause} className="btn-add">+ Clausola</button>}>
        {quote.legalClauses?.map((clause) => (
          <div className="clause-editor" key={clause.id}>
            <input value={clause.title} onChange={(e) => updateClause(clause.id, "title", e.target.value)} />
            <textarea value={clause.body} onChange={(e) => updateClause(clause.id, "body", e.target.value)} rows={2} />
            <button className="btn-remove" onClick={() => removeClause(clause.id)}>Rimuovi</button>
          </div>
        ))}
      </Section>
    </section>
  );

  const focusModeToggle = (
    <button
      data-testid="focus-toggle"
      className="focus-toggle"
      onClick={() => setPreviewFocus(!previewFocus)}
      title={previewFocus ? 'Esci da focus mode' : 'Focus mode anteprima'}
      aria-label={previewFocus ? 'Esci da focus mode' : 'Focus mode anteprima'}
    >
      {previewFocus ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M15 21h4a2 2 0 0 0 2-2v-4"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
      )}
      <span>{previewFocus ? 'Esci' : 'Focus'}</span>
    </button>
  );

  return (
    <div className={`editor-grid ${previewFocus ? 'focus-mode' : ''} ${!showAi && !showManual ? 'both-collapsed' : ''} ${!showAi || !showManual ? 'one-collapsed' : ''}`}>
      <div className={`editor-col ai-col ${showAi ? '' : 'collapsed'}`}>
        {showAi ? aiPanel : (
          <div className="panel-tab" onClick={() => setShowAi(true)} title="Mostra pannello AI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>AI</span>
          </div>
        )}
      </div>

      <div className={`editor-col manual-col ${showManual ? '' : 'collapsed'}`}>
        {showManual ? manualPanel : (
          <div className="panel-tab" onClick={() => setShowManual(true)} title="Mostra pannello controllo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>Man</span>
          </div>
        )}
      </div>

      <div className="editor-mobile-actions">
        {isDirty ? (
          <span className="save-status-mobile" style={{ color: 'var(--amber)', fontSize: '.7rem', fontWeight: 600 }}>● Modifiche non salvate</span>
        ) : lastSaveTime ? (
          <span className="save-status-mobile" style={{ color: 'var(--green)', fontSize: '.7rem', fontWeight: 600 }}>● Salvato alle {lastSaveTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
        ) : null}
        <div className="editor-mobile-actions-buttons">
          {onImportPDF && (
            <button onClick={onImportPDF} className="mobile-action-btn" title="Importa PDF" aria-label="Importa PDF">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
          )}
          <button onClick={onSave} className="mobile-action-btn mobile-action-btn-save" title="Salva (Ctrl+S)" aria-label="Salva">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </button>
          {onSaveAsTemplate && (
            <button onClick={onSaveAsTemplate} className="mobile-action-btn" title="Salva come template" aria-label="Salva come template">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </button>
          )}
          <button onClick={onExportPDF} className="mobile-action-btn mobile-action-btn-export" title="Esporta PDF (Ctrl+P)" aria-label="Esporta PDF" disabled={pdfLoading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          {onExportDOCX && (
            <button onClick={onExportDOCX} className="mobile-action-btn" title="Esporta DOCX (Ctrl+D)" aria-label="Esporta DOCX" disabled={docxLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="editor-mobile-bar">
        <button className={mobileTab === 'ai' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'ai' ? null : 'ai')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>
          AI
        </button>
        <button className={mobileTab === 'manual' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'manual' ? null : 'manual')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Manuale
        </button>
        {!previewFocus && (
          <button data-testid="focus-toggle-mobile" onClick={() => setPreviewFocus(true)} aria-pressed={false} className="">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>
            Focus
          </button>
        )}
      </div>

      {mobileTab && (
        <div className="editor-mobile-panel">
          {mobileTab === 'ai' ? aiPanel : manualPanel}
        </div>
      )}

      <section className={`preview-wrap ${!showAi && !showManual ? 'full' : !showAi || !showManual ? 'wide' : ''} ${previewFocus ? 'preview-focus' : ''}`} aria-label="Anteprima preventivo">
        <div className="preview-toolbar">
          {previewFocus && focusModeToggle}
        </div>
        <DocumentPreview ref={previewRef as React.Ref<HTMLElement>} quote={quote} documentTheme={documentTheme} />
      </section>
    </div>
  );
}
