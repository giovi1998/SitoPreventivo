import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import GlobalStyles from './GlobalStyles';
import Layout from './Layout';
import Topbar from './Topbar';
import ErrorBoundary from './ErrorBoundary';
import TierLimitModal from './TierLimitModal';
import type { PremiumQuote, DocumentTemplateId } from '../utils/quoteSchema';
import { migrateFromLegacy, toLegacyFormat, recalculateQuote, addEmptyOption } from '../utils/quoteSchema';
import { generateDOCX } from '../utils/generateDOCX';
import PdfImportModal from './PdfImportModal';
import SaveDialog from './SaveDialog';
import ToastContainer from './ToastContainer';
import ConfirmModal from './ConfirmModal';
import OnboardingModal from './OnboardingModal';
import dataService from '../utils/dataService';
import { DEFAULT_TEMPLATES } from '../utils/defaultTemplates';
import { summarizeMergeChanges, buildErrorSuggestion } from '../utils/mergeSummary';
import { needsAnalysis } from '../ai/promptUtils';
import { AppContext, AuthContext } from '../contexts';
import { useRouteView } from '../hooks/useRouteView';
import { useAI } from '../hooks/useAI';
import { useToast } from '../hooks/useToast';
import { tryCatch } from '../utils/errors';
import { FREE_DOCUMENT_LIMIT } from '../utils/watermark';

function generateId() {
  const year = new Date().getFullYear();
  const num = Math.floor(100 + Math.random() * 899);
  return `PRV-${year}-${num}`;
}

const STARTER_OPTIONS_LEGACY = [
  { id: 'opt-1', title: "OPZIONE 1 — Sito Vetrina WordPress · Con Manutenzione", description: "Sito vetrina professionale realizzato con WordPress.", oneTimeCost: 750, monthlyCost: 50, includesMaintenance: true },
  { id: 'opt-2', title: "OPZIONE 2 — Sito Vetrina WordPress · Senza Manutenzione", description: "Stessa realizzazione dell'Opzione 1.", oneTimeCost: 950, monthlyCost: 0, includesMaintenance: false },
  { id: 'opt-3', title: "OPZIONE 3 — Sito Vetrina su Misura · Con Manutenzione", description: "Sito sviluppato su misura in HTML, CSS e JavaScript.", oneTimeCost: 550, monthlyCost: 50, includesMaintenance: true },
  { id: 'opt-4', title: "OPZIONE 4 — Sito Vetrina su Misura · Senza Manutenzione", description: "Stessa realizzazione dell'Opzione 3.", oneTimeCost: 700, monthlyCost: 0, includesMaintenance: false },
];

const STARTER_CLAUSES_LEGACY = [
  { id: "cl-1", title: "Fornitura materiali", body: "La cliente si impegna a fornire tutti i contenuti necessari alla realizzazione del sito." },
  { id: "cl-2", title: "Consegna stimata", body: "La consegna del sito è stimata entro 3–4 settimane dalla ricezione di tutti i materiali." },
  { id: "cl-3", title: "Revisioni incluse", body: "Il preventivo include 2 round di revisione su grafica e contenuti." },
  { id: "cl-4", title: "Proprietà del sito", body: "Il sito diventerà di piena proprietà della cliente solo a saldo completato." },
];

const STARTER_QUOTE_PREMIUM = migrateFromLegacy({
  id: generateId(),
  title: "PREVENTIVO SITO WEB",
  client: "Francesca",
  contact: "Francesca",
  status: "Bozza",
  date: new Date().toISOString().slice(0, 10),
  owner: "Giovanni Cidu",
  intro: "Tutti i preventivi includono ottimizzazione SEO base.\nModalità di pagamento: 50% acconto, saldo entro 30 giorni.",
  note: "",
  vat: 22,
  color: "#0B57D0",
  options: STARTER_OPTIONS_LEGACY,
  clauses: STARTER_CLAUSES_LEGACY,
});

export default function AppShell() {
  const { view, setView } = useRouteView();
  const [quote, setQuote] = useState<PremiumQuote>(STARTER_QUOTE_PREMIUM);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [aiText, setAiText] = useState("Rendi il preventivo più professionale e aggiungi dettagli tecnici");
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [documentTheme, setDocumentTheme] = useState<DocumentTemplateId>(() =>
    (localStorage.getItem('documentTheme') as DocumentTemplateId) || 'corporate'
  );
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');
  // Phase 5 — tier system
  const [tier, setTier] = useState<'free' | 'unlocked' | 'loading'>('loading');
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [showTierLimitModal, setShowTierLimitModal] = useState(false);
  const { logout, user } = useContext(AuthContext);

  const {
    processPrompt,
    resetChat,
    aiLogs,
    isProcessing,
    availableModels,
  } = useAI(user?.email);
  const previewRef = useRef<HTMLElement>(null);

  const { toasts, addToast, dismissToast } = useToast();

  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('documentTheme', documentTheme);
  }, [documentTheme]);

  // Phase 5: refresh tier when user changes
  const refreshTier = useCallback(async () => {
    if (!user?.email) {
      setTier('free');
      setDocumentCount(0);
      return;
    }
    if (user.email === 'admin@gmail.com') {
      setTier('unlocked');
      setDocumentCount(0);
      return;
    }
    const res: any = await dataService.getUserTier(user.email);
    if (res && !res.error) {
      setTier(res.tier === 'unlocked' ? 'unlocked' : 'free');
      setDocumentCount(res.documentCount || 0);
    }
  }, [user?.email]);

  useEffect(() => {
    refreshTier();
  }, [refreshTier]);

  /**
   * Check if the user can save a new document. Returns true if OK,
   * false if the free limit is reached (in which case the tier modal
   * is shown automatically).
   */
  const checkDocumentLimit = useCallback((): boolean => {
    if (tier === 'unlocked' || tier === 'loading') return true;
    if (documentCount >= FREE_DOCUMENT_LIMIT) {
      setShowTierLimitModal(true);
      return false;
    }
    return true;
  }, [tier, documentCount]);

  useEffect(() => {
    if (user?.email) {
      if (user.email === 'admin@gmail.com') return;
      dataService.getUserSettings(user.email).then((settings: any) => {
        if (settings?.error) {
          console.error('[Onboarding] Failed to load settings:', settings.error);
          addToast('error', 'Errore caricamento impostazioni utente');
          setShowOnboarding(true);
          return;
        }
        const requiredFields = ['displayName', 'companyName', 'profession', 'defaultColor', 'defaultVat', 'documentTheme'];
        const isComplete = settings && requiredFields.every(f => settings[f] != null && settings[f] !== '');

        if (!isComplete) {
          setShowOnboarding(true);
        } else {
          if (settings.defaultColor) setQuote((c) => ({ ...c, uiPreferences: { ...c.uiPreferences, accentColor: settings.defaultColor } }));
          if (settings.defaultVat) setQuote((c) => ({ ...c, options: c.options.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, tax: { ...i.tax, rate: settings.defaultVat } })) })) }));
          if (settings.documentTheme) setDocumentTheme(settings.documentTheme);
        }
      }).catch((err) => {
        console.error('[Onboarding] Exception loading settings:', err);
        addToast('error', 'Errore caricamento impostazioni utente');
        setShowOnboarding(true);
      });
    }
  }, [user?.email]);

  const handleOnboardingComplete = async (settings: any) => {
    if (user?.email) {
      if (user.email === 'admin@gmail.com') {
        setShowOnboarding(false);
        return;
      }
      const result = await dataService.saveUserSettings(user.email, { ...settings, documentTheme });
      if (result?.error) {
        console.error('[Onboarding] Failed to save settings:', result.error);
        addToast('error', 'Errore salvataggio impostazioni: ' + result.error);
        return;
      }
      if (settings.defaultColor) {
        setQuote((c) => ({ ...c, uiPreferences: { ...c.uiPreferences, accentColor: settings.defaultColor } }));
      }
      if (settings.defaultVat) {
        setQuote((c) => ({ ...c, options: c.options.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, tax: { ...i.tax, rate: settings.defaultVat } })) })) }));
      }
      if (settings.documentTheme) setDocumentTheme(settings.documentTheme);
      if (settings.profession === 'altro') {
        const francesca = toLegacyFormat(STARTER_QUOTE_PREMIUM);
        setQuote(migrateFromLegacy(francesca));
      }
    }
    setShowOnboarding(false);
    addToast('success', 'Benvenuto! Configurazione completata.');
  };

  useEffect(() => {
    if (user?.email) {
      dataService.getTemplates('admin@gmail.com').then(({ quotes: globalTemplates }: any) => {
        if (!globalTemplates || globalTemplates.length === 0) {
          DEFAULT_TEMPLATES.forEach(t => dataService.saveQuote('admin@gmail.com', t));
        }
      }).catch(() => {});
      dataService.getQuotes(user.email).then(({ quotes: loaded }: any) => {
        setQuotes(loaded || []);
      }).catch(() => {});
    }
  }, [user?.email]);

  const markDirty = () => setIsDirty(true);

  const runAI = async (mode = "custom") => {
    const prompt = aiText.trim();
    if (!prompt && mode === "custom") { addToast('info', 'Scrivi un prompt per l\'AI.'); return; }

    const prompts: Record<string, string> = {
      premium: "Rendi il preventivo premium: descrizioni più esclusive, colore accattivante, titolo con 'Edizione Premium'.",
      faq: "Aggiungi una clausola 'FAQ cliente' con domande frequenti su tempi, revisioni, proprietà dei file e supporto. Mantieni le clausole esistenti.",
      discount: "Applica uno sconto del 10% su tutti i costi una tantum delle opzioni.",
      simple: "Semplifica il documento: riduci le descrizioni delle opzioni all'essenziale, mantieni solo le prime 2 clausole.",
      custom: prompt,
    };
    const userPrompt = prompts[mode] || prompt;

    try {
      const result = await processPrompt(quote, userPrompt, {
        modelId: aiModel,
        onProgress: () => {},
        onStream: () => {},
      });

      setQuote(result.quote as PremiumQuote);
      markDirty();

      const { count, summary } = summarizeMergeChanges(result.changes);
      if (count > 0) {
        addToast('success', `AI: ${summary}`, 5000);
      } else {
        const wasAnalysis = needsAnalysis(userPrompt);
        addToast(
          'info',
          wasAnalysis
            ? 'AI: nessuna modifica applicata — vedi log per la risposta testuale'
            : 'AI: nessuna modifica riconosciuta dal prompt. Riformula più specificamente?',
          5000
        );
      }
    } catch (err: any) {
      const suggestion = buildErrorSuggestion(err.message || '');
      addToast('error', suggestion, 5000);
    }
  };

  const saveQuote = () => setShowSaveDialog(true);

  const saveCurrentQuote = (optsOrTitle?: { title?: string; silent?: boolean } | string) => {
    const opts = typeof optsOrTitle === 'string' ? { title: optsOrTitle } : (optsOrTitle || {});
    const title = opts.title
      ?? (opts.silent ? quote.project.title : `${quote.project.title} (auto)`);
    const saved = { ...quote, project: { ...quote.project, title } };
    const legacy = toLegacyFormat(saved);
    setQuotes((c: any[]) => {
      const updated = [legacy, ...c.filter((qq: any) => qq.id !== saved.quoteId)];
      if (user?.email) dataService.saveQuote(user.email, legacy);
      return updated;
    });
    setIsDirty(false);
    setLastSaveTime(new Date());
    addToast('success', title ? `"${title}" salvato` : 'Preventivo salvato');
  };

  const handleSaveConfirmed = (customName: string) => {
    setShowSaveDialog(false);
    saveCurrentQuote(customName);
  };

  const duplicate = (saved: any) => {
    const now = new Date().toISOString();
    const copy = migrateFromLegacy({ ...saved, id: generateId(), status: 'Bozza', date: now.slice(0, 10), title: `${saved.title} (copia)` });
    const legacy = toLegacyFormat(copy);
    setQuotes((c: any[]) => {
      const updated = [legacy, ...c];
      if (user?.email) dataService.saveQuote(user.email, legacy);
      return updated;
    });
    setQuote(copy);
    setView("editor");
    setIsDirty(true);
    addToast('success', 'Preventivo duplicato');
  };

  const saveAsTemplate = () => {
    const template = { ...quote, quoteId: generateId(), client: { ...quote.client, name: '' } };
    const legacy = { ...toLegacyFormat(template), isTemplate: true, isGlobal: false, owner: user?.email || '' };
    setQuotes((c: any[]) => {
      const updated = [legacy, ...c];
      if (user?.email) dataService.saveQuote(user.email, legacy);
      return updated;
    });
    addToast('success', 'Template salvato');
  };

  const createFromTemplate = (template: any) => {
    const migrated = migrateFromLegacy({ ...template, id: generateId(), status: 'Bozza', date: new Date().toISOString().slice(0, 10) });
    setQuote(migrated);
    setView("editor");
    setIsDirty(true);
    addToast('success', 'Template applicato');
  };

  const patch = (key: string, value: any) => {
    markDirty();
    if (key === 'title') setQuote((c) => ({ ...c, project: { ...c.project, title: value } }));
    else if (key === 'client') setQuote((c) => ({ ...c, client: { ...c.client, name: value } }));
    else if (key === 'intro') setQuote((c) => ({ ...c, project: { ...c.project, description: value } }));
    else if (key === 'color') setQuote((c) => ({ ...c, uiPreferences: { ...c.uiPreferences, accentColor: value } }));
    else if (key === 'vat') setQuote((c) => ({ ...c, options: c.options.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i, tax: { ...i.tax, rate: Number(value) } })) })) }));
    else if (key === 'owner') setQuote((c) => ({ ...c, issuer: { ...c.issuer, name: value } }));
    else if (key === 'note') setQuote((c) => ({ ...c, notes: { ...c.notes, internal: value } }));
    else if (key === 'date') setQuote((c) => ({ ...c, createdAt: value }));
    else if (key === 'contact') setQuote((c) => ({ ...c, client: { ...c.client, contactPerson: value } }));
    else if (key === 'documentTheme') setDocumentTheme(value);
  };

  const updateOption = (id: string, key: string, value: any) => {
    markDirty();
    setQuote((c) => {
      const options = c.options.map((o) => {
        if (o.id !== id) return o;
        if (key === 'title') return { ...o, label: value };
        if (key === 'description') return { ...o, description: value };
        if (key === 'oneTimeCost') {
          const items = o.items.map((item) =>
            item.unit === 'fixed'
              ? { ...item, unitPrice: Number(value) }
              : item
          );
          return { ...o, items };
        }
        if (key === 'monthlyCost') {
          const items = o.items.map((item) =>
            item.unit === 'month'
              ? { ...item, unitPrice: Number(value) }
              : item
          );
          return { ...o, items };
        }
        if (key === 'includesMaintenance') {
          const items = o.items.map((item) =>
            item.label.toLowerCase().includes('manutenzione')
              ? { ...item, quantity: value ? 12 : 0 }
              : item
          );
          return { ...o, items };
        }
        return o;
      });
      return recalculateQuote({ ...c, options });
    });
  };

  const updateOptions = (newOptions: any[]) => {
    markDirty();
    setQuote((c) => recalculateQuote({ ...c, options: newOptions }));
  };

  const addOption = () => {
    markDirty();
    setQuote((c) => addEmptyOption(c));
  };

  const removeOption = (id: string) => {
    markDirty();
    setQuote((c) => recalculateQuote({ ...c, options: c.options.filter((o) => o.id !== id) }));
  };

  const updateClause = (id: string, key: string, value: string) => {
    markDirty();
    setQuote((c) => ({
      ...c,
      legalClauses: c.legalClauses.map((cl) => (cl.id === id ? { ...cl, [key]: value } : cl)),
    }));
  };

  const addClause = () => {
    markDirty();
    setQuote((c) => ({
      ...c,
      legalClauses: [
        ...c.legalClauses,
        { id: `cl-${Date.now()}`, title: 'Nuova clausola', body: 'Contenuto della clausola...', language: 'it' },
      ],
    }));
  };

  const removeClause = (id: string) => {
    markDirty();
    setQuote((c) => ({ ...c, legalClauses: c.legalClauses.filter((cl) => cl.id !== id) }));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === 's') { e.preventDefault(); saveCurrentQuote(); }
      if (e.key === 'p') { e.preventDefault(); exportPDF(); }
      if (e.key === 'd') { e.preventDefault(); exportDOCX(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quote]);

  const openQuote = (saved: any) => {
    const migrated = migrateFromLegacy(saved);
    setQuote(migrated);
    setView("editor");
    addToast('info', `${saved.id} aperto in modifica.`);
  };

  const updateQuoteStatus = (id: string, newStatus: string) => {
    setQuotes((c: any[]) => c.map((q: any) => q.id === id ? { ...q, status: newStatus } : q));
    if (user?.email) {
      const q = quotes.find((qq: any) => qq.id === id);
      if (q) dataService.saveQuote(user.email, { ...q, status: newStatus });
    }
  };

  const exportPDF = async () => {
    setPdfLoading(true);
    const { error } = await tryCatch(async () => {
      const { generatePDFBlob } = await import('../utils/generatePDF');
      const currentTier: 'free' | 'unlocked' = tier === 'unlocked' ? 'unlocked' : 'free';
      const pdfBytes = await generatePDFBlob(quote, documentTheme, currentTier);
      const filename = `${quote.quoteId || quote.project?.title || 'preventivo'}_${quote.client?.name || 'preventivo'}.pdf`;
      const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, 'Errore esportazione PDF');
    if (error) { addToast('error', error); } else { addToast('success', 'PDF scaricato'); }
    setPdfLoading(false);
  };

  const exportDOCX = async () => {
    setDocxLoading(true);
    const { error } = await tryCatch(() => generateDOCX(quote, documentTheme), 'Errore esportazione DOCX');
    if (error) { addToast('error', error); } else { addToast('success', 'DOCX esportato'); }
    setDocxLoading(false);
  };

  const handlePdfImport = (importedQuote: PremiumQuote) => {
    setQuote(importedQuote);
    setShowPdfImport(false);
    setIsDirty(true);
    addToast('success', `PDF importato: ${importedQuote.project?.title}`);
  };

  const ctxValue = {
    editingQuote: quote, setEditingQuote: setQuote, saveQuote, quotes,
    setView, openQuote, duplicate, removeQuote: (id: string) => {
      setQuotes((c: any[]) => c.filter((q: any) => q.id !== id));
      if (user?.email) dataService.deleteQuote(id, user.email);
    },
    onUpdateStatus: updateQuoteStatus,
    onDeleteRequest: (item: any) => setDeleteTarget(item),
    createFromTemplate,
    runAI,
    aiText, setAiText, aiModel, setAiModel,
    patch, updateOption, updateOptions, addOption, removeOption,
    updateClause, addClause, removeClause,
    exportPDF, exportDOCX, saveCurrentQuote, saveAsTemplate,
    previewRef, aiLogs, isProcessing, availableModels, resetChat,
    isDirty, lastSaveTime, pdfLoading, docxLoading, documentTheme, setDocumentTheme,
    onImportPDF: () => setShowPdfImport(true),
    // Phase 5 — tier system
    tier,
    documentCount,
    refreshTier,
    checkDocumentLimit,
  } as any;

  return (
    <AppContext.Provider value={ctxValue}>
      <GlobalStyles />
      <ErrorBoundary>
        <Layout view={view} setView={setView} onLogout={logout} onSave={saveQuote} user={user} theme={theme} setTheme={setTheme}>
          <Topbar
            view={view}
            onSave={saveQuote}
            onExportPDF={exportPDF}
            onExportDOCX={exportDOCX}
            onImportPDF={() => setShowPdfImport(true)}
            lastSaveTime={lastSaveTime}
            isDirty={isDirty}
            isProcessing={isProcessing}
            pdfLoading={pdfLoading}
            docxLoading={docxLoading}
            onSaveAsTemplate={saveAsTemplate}
            theme={theme}
            setTheme={setTheme}
            documentTheme={documentTheme}
            onDocumentThemeChange={(t) => setDocumentTheme(t)}
          />
          <Outlet />
        </Layout>
      </ErrorBoundary>
      <SaveDialog
        open={showSaveDialog}
        defaultName={quote.project?.title || 'Preventivo'}
        onSave={handleSaveConfirmed}
        onCancel={() => setShowSaveDialog(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina preventivo"
        message={deleteTarget ? `Stai per eliminare «${deleteTarget.title}». Non potrai recuperarlo.` : ''}
        confirmLabel="Elimina"
        confirmClass="danger"
        onConfirm={() => {
          if (deleteTarget) {
            setQuotes((c: any[]) => c.filter((q: any) => q.id !== deleteTarget.id));
            if (user?.email) dataService.deleteQuote(deleteTarget.id, user.email);
            addToast('success', 'Preventivo eliminato');
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {showPdfImport && (
        <PdfImportModal
          onClose={() => setShowPdfImport(false)}
          onImport={handlePdfImport}
          chatWithAI={async (prompt: string) => {
            const result = await processPrompt(quote, prompt, { modelId: aiModel });
            return result.response.content || '{}';
          }}
        />
      )}
      {/* Phase 5 — Tier limit modal (shown when free user hits the 3-doc cap) */}
      <TierLimitModal
        open={showTierLimitModal}
        userEmail={user?.email || ''}
        onClose={() => setShowTierLimitModal(false)}
        onRedeemed={() => {
          refreshTier();
          addToast('success', 'Piano sbloccato! Documenti illimitati.');
        }}
      />
    </AppContext.Provider>
  );
}
