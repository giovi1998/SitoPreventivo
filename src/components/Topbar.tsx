import type { DocumentTemplateId } from '../utils/quoteSchema';

function formatTime(date: Date) {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

interface TopbarProps {
  view: string;
  onSave: () => void;
  onExportPDF: () => void;
  onExportDOCX?: () => void;
  onImportPDF?: () => void;
  lastSaveTime: Date | null;
  isDirty: boolean;
  isProcessing?: boolean;
  pdfLoading: boolean;
  docxLoading?: boolean;
  onSaveAsTemplate?: () => void;
  theme: string;
  setTheme: (t: string) => void;
  documentTheme: DocumentTemplateId;
  onDocumentThemeChange?: (t: DocumentTemplateId) => void;
}

export default function Topbar({
  view,
  onSave,
  onExportPDF,
  onExportDOCX,
  onImportPDF,
  lastSaveTime,
  isDirty,
  isProcessing = false,
  pdfLoading,
  docxLoading,
  onSaveAsTemplate,
  theme,
  setTheme,
  documentTheme,
  onDocumentThemeChange,
}: TopbarProps) {
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const titles: Record<string, { kicker: string; title: string }> = {
    editor: { kicker: 'Editor operativo', title: 'Editor preventivo' },
    admin: { kicker: 'Pannello di controllo', title: 'Admin' },
    settings: { kicker: 'Gestione credenziali', title: 'Impostazioni' },
    collection: { kicker: 'Raccolta documenti', title: 'Collection' },
    card: { kicker: 'Bigliettino da visita', title: 'Bigliettini' },
    qr: { kicker: 'Generatore QR Code', title: 'QR Code' },
    flyer: { kicker: 'Volantino / Locandina', title: 'Volantini' },
    logo: { kicker: 'Logo Builder', title: 'Logo' },
  };
  const current = titles[view] || titles.collection;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <p>{current.kicker}</p>
        <h1>{current.title}</h1>
      </div>
      <div className="top-actions">
        {view === 'editor' && (
          <div className="editor-actions">
            <div className="save-status">
              {isProcessing ? (
                <span className="save-status-processing">
                  <span className="spinner-mini" aria-hidden="true" />
                  AI in corso, salvataggio sospeso
                </span>
              ) : isDirty ? (
                <span className="save-status-dirty">● Non salvato</span>
              ) : lastSaveTime ? (
                <span className="save-status-saved">● Salvato {formatTime(lastSaveTime)}</span>
              ) : null}
            </div>

            {onDocumentThemeChange && (
              <div className="theme-pills" role="tablist" aria-label="Tema documento">
                {(['minimal', 'corporate', 'creative'] as DocumentTemplateId[]).map((tid) => (
                  <button
                    key={tid}
                    type="button"
                    role="tab"
                    aria-selected={documentTheme === tid}
                    title={`Tema ${tid}`}
                    className={`theme-pill ${documentTheme === tid ? 'active' : ''}`}
                    onClick={() => onDocumentThemeChange(tid)}
                  >
                    {tid === 'minimal' ? 'Min' : tid === 'corporate' ? 'Corp' : 'Cre'}
                  </button>
                ))}
              </div>
            )}

            <div className="action-group">
              {onImportPDF && (
                <button onClick={onImportPDF} className="top-btn-ghost" title="Importa PDF" aria-label="Importa PDF">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <span className="btn-label">Importa</span>
                </button>
              )}

              <button onClick={onSave} className="top-btn-save" title="Salva (Ctrl+S)" aria-label="Salva">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                <span className="btn-label">Salva</span>
              </button>

              {onSaveAsTemplate && (
                <button onClick={onSaveAsTemplate} className="top-btn-ghost" title="Salva come template" aria-label="Template">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18"/>
                    <path d="M9 21V9"/>
                  </svg>
                  <span className="btn-label">Template</span>
                </button>
              )}

              <button className="top-btn-export" onClick={onExportPDF} title="Esporta PDF (Ctrl+P)" disabled={pdfLoading} aria-label="Esporta PDF">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span className="btn-label">{pdfLoading ? '...' : 'PDF'}</span>
              </button>

              {onExportDOCX && (
                <button onClick={onExportDOCX} className="top-btn-ghost" title="Esporta DOCX (Ctrl+D)" disabled={docxLoading} aria-label="Esporta DOCX">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span className="btn-label">{docxLoading ? '...' : 'DOCX'}</span>
                </button>
              )}
            </div>
          </div>
        )}
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'} aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}>
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
