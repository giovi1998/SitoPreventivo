import { useState, useRef, useCallback } from 'react';
import type { PremiumQuote } from '../utils/quoteSchema';
import { parsePDF, buildImportPrompt, reconstructQuoteFromAI } from '../utils/pdfImporter';

type Step = 'upload' | 'analyze' | 'confirm';

interface PdfImportModalProps {
  onClose: () => void;
  onImport: (quote: PremiumQuote) => void;
  chatWithAI: (prompt: string) => Promise<string>;
}

export default function PdfImportModal({ onClose, onImport, chatWithAI }: PdfImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedText, setParsedText] = useState('');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importedQuote, setImportedQuote] = useState<PremiumQuote | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ page: number; progress: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.type.includes('pdf') && !selectedFile.name.endsWith('.pdf')) {
      setError('Seleziona un file PDF valido');
      return;
    }
    setFile(selectedFile);
    setError('');
    setLoading(true);
    setStep('analyze');
    setOcrProgress(null);

    try {
      const parsed = await parsePDF(selectedFile, (page, progress) => {
        setOcrProgress({ page, progress });
      });
      setRawText(parsed.rawText);
      setParsedText(parsed.rawText.slice(0, 3000));
      setOcrProgress(null);

      const prompt = buildImportPrompt(parsed);
      const aiResponse = await chatWithAI(prompt);

      let aiJson: Record<string, unknown>;
      try {
        aiJson = JSON.parse(aiResponse);
      } catch {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiJson = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Risposta AI non valida');
        }
      }

      const { quote } = reconstructQuoteFromAI(aiJson, parsed);
      setImportedQuote(quote);
      setStep('confirm');
    } catch (err) {
      setError(`Errore durante l'import: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }, [chatWithAI]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleImport = () => {
    if (importedQuote) {
      onImport(importedQuote);
    }
  };

  const handleRegenerate = async () => {
    if (!file) return;
    setLoading(true);
    setStep('analyze');
    setOcrProgress(null);
    try {
      const parsed = await parsePDF(file, (page, progress) => {
        setOcrProgress({ page, progress });
      });
      const prompt = buildImportPrompt(parsed);
      const aiResponse = await chatWithAI(prompt + '\n\nRigenera con maggior precisione.');
      let aiJson: Record<string, unknown>;
      try {
        aiJson = JSON.parse(aiResponse);
      } catch {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        aiJson = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      }
      const { quote } = reconstructQuoteFromAI(aiJson, parsed);
      setImportedQuote(quote);
      setStep('confirm');
    } catch (err) {
      setError(`Errore durante la rigenerazione: ${err instanceof Error ? err.message : 'Errore'}`);
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-import-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pdf-import-modal">
        <div className="pdf-import-header">
          <h2>Importa Preventivo da PDF</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px 10px', fontSize: '.85rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="pdf-import-body">
          <div className="pdf-import-step">
            <span className={step === 'upload' ? 'active' : step === 'analyze' || step === 'confirm' ? 'done' : ''}>1</span>
            <div className="step-line" />
            <span className={step === 'analyze' ? 'active' : step === 'confirm' ? 'done' : ''}>2</span>
            <div className="step-line" />
            <span className={step === 'confirm' ? 'active' : ''}>3</span>
          </div>

          {step === 'upload' && (
            <div
              className={`dropzone ${dragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p>Trascina il tuo PDF qui</p>
              <small>oppure clicca per selezionare un file</small>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {error && <p style={{ color: 'var(--red)', marginTop: '8px', fontSize: '.82rem' }}>{error}</p>}
            </div>
          )}

          {step === 'analyze' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 700, fontSize: '.9rem' }}>
                {ocrProgress ? `OCR in corso (pagina ${ocrProgress.page})...` : 'Analisi del PDF in corso...'}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                {ocrProgress ? 'Riconoscimento ottico dei caratteri per PDF scansionato.' : 'Il testo viene estratto e inviato all\'AI per la ricostruzione.'}
              </p>
              {ocrProgress && (
                <div style={{ width: '80%', maxWidth: '300px', margin: '12px auto', height: '6px', background: 'var(--surface-sun)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${ocrProgress.progress * 100}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.2s' }} />
                </div>
              )}
              {parsedText && (
                <details style={{ marginTop: '16px', textAlign: 'left' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '.8rem' }}>Testo estratto (anteprima)</summary>
                  <pre style={{ marginTop: '8px', padding: '12px', background: 'var(--surface-sun)', borderRadius: '8px', fontSize: '.72rem', maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{parsedText}</pre>
                </details>
              )}
            </div>
          )}

          {step === 'confirm' && importedQuote && (
            <div>
              <div className="pdf-preview-split">
                <div className="pdf-preview-col">
                  <h4>Testo estratto dal PDF</h4>
                  <div style={{ fontSize: '.72rem', lineHeight: 1.5 }}>{rawText.slice(0, 2000)}{rawText.length > 2000 ? '...' : ''}</div>
                </div>
                <div className="pdf-preview-col">
                  <h4>Preventivo generato</h4>
                  <div style={{ fontSize: '.72rem', lineHeight: 1.5 }}>
                    <p><strong>Titolo:</strong> {importedQuote.project?.title || ':'}</p>
                    <p><strong>Cliente:</strong> {importedQuote.client?.name || ':'}</p>
                    <p><strong>Opzioni:</strong> {importedQuote.options?.length || 0}</p>
                    <p><strong>Voci di costo:</strong> {importedQuote.options?.reduce((s, o) => s + o.items.length, 0) || 0}</p>
                    <p><strong>Totale:</strong> {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(importedQuote.globalTotals?.totalGross || 0)}</p>
                    <p><strong>Clausole:</strong> {importedQuote.legalClauses?.length || 0}</p>
                    <p><strong>Confidenza:</strong> {((importedQuote.importSource as any)?.confidence * 100 || 0).toFixed(0)}%</p>
                  </div>
                </div>
              </div>

              {error && <p style={{ color: 'var(--red)', marginTop: '8px', fontSize: '.82rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="btn-ghost" onClick={onClose} style={{ padding: '10px 20px' }}>Annulla</button>
                <button className="btn-ghost" onClick={handleRegenerate} disabled={loading}>
                  {loading ? 'Rigenerazione...' : 'Rigenera'}
                </button>
                <button className="btn-primary" onClick={handleImport} style={{ padding: '10px 20px' }}>
                  Conferma e importa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
