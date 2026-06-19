import React, { lazy, Suspense } from 'react';
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import GlobalStyles from './src/components/GlobalStyles';
import Layout from './src/components/Layout';
import Topbar from './src/components/Topbar';
import EditorView from './src/components/EditorView';
import type { PremiumQuote, DocumentTemplateId } from './src/utils/quoteSchema';
import { createEmptyQuote, migrateFromLegacy, toLegacyFormat, recalculateQuote, addEmptyOption } from './src/utils/quoteSchema';
import { generateDOCX } from './src/utils/generateDOCX';
import PdfImportModal from './src/components/PdfImportModal';
import { ToolDispatcher } from './src/utils/toolDispatcher';
import { applyDiscount, adjustMargin, duplicateOption, recalculateTotals, reorderOptions, removeEmptyItems, mergeDuplicateItems, roundPrices, calculateAnnualCost, checkConsistency, generateSummary, validateQuoteTool, enhanceDescriptionsPrompt, translateQuotePrompt } from './src/utils/quoteTools';
const CollectionView = lazy(() => import('./src/components/CollectionView'));
const AdminDashboard = lazy(() => import('./src/pages/AdminDashboard'));
import SettingsPage from './src/pages/SettingsPage';
import CollectionViewSkeleton from './src/components/CollectionViewSkeleton';
import SaveDialog from './src/components/SaveDialog';
import ToastContainer from './src/components/ToastContainer';
import ConfirmModal from './src/components/ConfirmModal';
import OnboardingModal from './src/components/OnboardingModal';
import dataService from './src/utils/dataService';

export const AppContext = createContext<any>(null);
export const AuthContext = createContext<any>(null);

function generateId() {
  const year = new Date().getFullYear();
  const num = Math.floor(100 + Math.random() * 899);
  return `PRV-${year}-${num}`;
}

const STARTER_OPTIONS_LEGACY = [
  { id: 1, title: "OPZIONE 1 — Sito Vetrina WordPress · Con Manutenzione", description: "Sito vetrina professionale realizzato con WordPress.", oneTimeCost: 750, monthlyCost: 50, includesMaintenance: true },
  { id: 2, title: "OPZIONE 2 — Sito Vetrina WordPress · Senza Manutenzione", description: "Stessa realizzazione dell'Opzione 1.", oneTimeCost: 950, monthlyCost: 0, includesMaintenance: false },
  { id: 3, title: "OPZIONE 3 — Sito Vetrina su Misura · Con Manutenzione", description: "Sito sviluppato su misura in HTML, CSS e JavaScript.", oneTimeCost: 550, monthlyCost: 50, includesMaintenance: true },
  { id: 4, title: "OPZIONE 4 — Sito Vetrina su Misura · Senza Manutenzione", description: "Stessa realizzazione dell'Opzione 3.", oneTimeCost: 700, monthlyCost: 0, includesMaintenance: false },
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const username = localStorage.getItem('username');
    const regDate = localStorage.getItem('注册Date');
    const role = localStorage.getItem('userRole');
    if (token && email) {
      return { email, token, username: username || email.split('@')[0], 注册Date: regDate || new Date().toLocaleDateString('it-IT'), role: role || 'user' };
    }
    return null;
  });

  const register = async (email: string, password: string, username: string, gender: string) => {
    const result = await dataService.register(email, password, username, gender);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || username);
      localStorage.setItem('注册Date', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email, token: btoa(`${email}:${Date.now()}`), username: uData.username || username,
        gender: uData.gender || gender, role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0, tokenLimit: uData.tokenLimit || 1000000,
        注册Date: uData.createdAt || new Date().toLocaleDateString('it-IT'),
      });
    }
    return result;
  };

  const login = async (email: string, password: string) => {
    const result = await dataService.login(email, password);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || email.split('@')[0]);
      localStorage.setItem('注册Date', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email, token: btoa(`${email}:${Date.now()}`), username: uData.username || email.split('@')[0],
        gender: uData.gender, role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0, tokenLimit: uData.tokenLimit || 1000000,
        注册Date: uData.createdAt || new Date().toLocaleDateString('it-IT'),
      });
    }
    return result;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    localStorage.removeItem('注册Date');
    localStorage.removeItem('userRole');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function App() {
  const [view, setView] = useState("editor");
  const [quote, setQuote] = useState<PremiumQuote>(STARTER_QUOTE_PREMIUM);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [premiumQuotes, setPremiumQuotes] = useState<PremiumQuote[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [aiText, setAiText] = useState("Rendi il preventivo più professionale e aggiungi dettagli tecnici");
  const [activity, setActivity] = useState("Pronto: modifica manualmente il preventivo.");
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [toasts, setToasts] = useState<any[]>([]);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [documentTheme, setDocumentTheme] = useState<DocumentTemplateId>('corporate');
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');
  const toolDispatcherRef = useRef(new ToolDispatcher());
  const { logout, user } = useContext(AuthContext);
  const previewRef = useRef<HTMLElement>(null);

  const addToast = useCallback((type: string, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev: any[]) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev: any[]) => prev.filter((t: any) => t.id !== id));
  }, []);

  const setTheme = useCallback((t: string) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user?.email) {
      dataService.getUserSettings(user.email).then((settings: any) => {
        if (!settings.onboardingDone) setShowOnboarding(true);
      }).catch(() => {});
    }
  }, [user?.email]);

  const handleOnboardingComplete = async (settings: any) => {
    if (user?.email) {
      await dataService.saveUserSettings(user.email, settings);
      if (settings.defaultColor) {
        setQuote((c) => ({ ...c, uiPreferences: { ...c.uiPreferences, accentColor: settings.defaultColor } }));
      }
    }
    setShowOnboarding(false);
    addToast('success', 'Benvenuto! Configurazione completata.');
  };

  useEffect(() => {
    if (user?.email) {
      dataService.getQuotes(user.email).then(({ quotes: loaded }: any) => {
        if (loaded && loaded.length > 0) {
          const migrated = loaded.map((q: any) => {
            try { return migrateFromLegacy(q); } catch { return null; }
          }).filter(Boolean);
          setPremiumQuotes(migrated);
          setQuotes(loaded);
        } else {
          setPremiumQuotes([STARTER_QUOTE_PREMIUM]);
          setQuotes([]);
        }
      }).catch(() => {
        setPremiumQuotes([STARTER_QUOTE_PREMIUM]);
      });
    }
  }, [user?.email]);

  const addLog = (type: string, msg: string) =>
    setAiLogs((prev: any[]) => [...prev.slice(-19), { type, msg, time: new Date().toLocaleTimeString('it-IT') }]);

  const markDirty = () => setIsDirty(true);

  const mergeAIResponse = (currentQuote: PremiumQuote, modified: any): { quote: PremiumQuote; changes: string[] } => {
    const updated = { ...currentQuote };
    const changes: string[] = [];

    if (modified.project?.title) {
      updated.project = { ...updated.project, title: modified.project.title };
      changes.push(`Titolo progetto: "${modified.project.title}"`);
    }
    if (modified.project?.description) {
      updated.project = { ...updated.project, description: modified.project.description };
      changes.push(`Descrizione progetto aggiornata`);
    }
    if (modified.client?.name) {
      updated.client = { ...updated.client, name: modified.client.name };
      changes.push(`Cliente: "${modified.client.name}"`);
    }
    if (modified.uiPreferences?.accentColor) {
      updated.uiPreferences = { ...updated.uiPreferences, accentColor: modified.uiPreferences.accentColor };
      changes.push(`Colore tema: ${modified.uiPreferences.accentColor}`);
    }

    if (modified.options) {
      for (const mo of modified.options) {
        const existing = currentQuote.options.find((o) => o.id === mo.id);
        if (!existing) { changes.push(`Nuova opzione aggiunta`); continue; }

        const optLabel = existing.label;
        if (mo.label && mo.label !== existing.label) changes.push(`Opzione "${optLabel}": nome → "${mo.label}"`);
        if (mo.description !== undefined && mo.description !== existing.description) changes.push(`Opzione "${optLabel}": descrizione modificata`);

        if (mo.items) {
          for (const mi of mo.items) {
            const existingItem = existing.items.find((ei) => ei.id === mi.id);
            if (!existingItem) { changes.push(`Opzione "${optLabel}": nuova voce "${mi.label || 'senza nome'}"`); continue; }
            if (mi.unitPrice !== undefined && mi.unitPrice !== existingItem.unitPrice) changes.push(`Opzione "${optLabel}" → "${existingItem.label}": prezzo ${existingItem.unitPrice}€ → ${mi.unitPrice}€`);
            if (mi.quantity !== undefined && mi.quantity !== existingItem.quantity) changes.push(`Opzione "${optLabel}" → "${existingItem.label}": quantità ${existingItem.quantity} → ${mi.quantity}`);
            if (mi.description !== undefined && mi.description !== existingItem.description) changes.push(`Opzione "${optLabel}" → "${existingItem.label}": descrizione modificata`);
            if (mi.label && mi.label !== existingItem.label) changes.push(`Opzione "${optLabel}": voce rinominata "${existingItem.label}" → "${mi.label}"`);
          }
        }

        updated.options = modified.options.map((mo2: any) => {
          const ex = currentQuote.options.find((o) => o.id === mo2.id);
          if (ex) {
            return {
              ...ex,
              label: mo2.label || ex.label,
              description: mo2.description !== undefined ? mo2.description : ex.description,
              items: mo2.items ? mo2.items.map((mi: any) => {
                const ei = ex.items.find((e) => e.id === mi.id);
                return ei ? { ...ei, ...mi } : mi;
              }) : ex.items,
            };
          }
          return mo2;
        });
      }
      const recalculated = recalculateQuote({ ...currentQuote, options: updated.options });
      updated.options = recalculated.options;
      updated.globalTotals = recalculated.globalTotals;
    }

    if (modified.legalClauses) {
      for (const mc of modified.legalClauses) {
        const existing = currentQuote.legalClauses.find((cl) => cl.id === mc.id);
        if (existing) {
          if (mc.title && mc.title !== existing.title) changes.push(`Clausola: titolo → "${mc.title}"`);
          if (mc.body && mc.body !== existing.body) changes.push(`Clausola "${existing.title || mc.title}": testo modificato`);
        } else {
          changes.push(`Nuova clausola aggiunta: "${mc.title || 'senza titolo'}"`);
        }
      }
      updated.legalClauses = modified.legalClauses.map((mc: any) => {
        const existing = currentQuote.legalClauses.find((cl) => cl.id === mc.id);
        return existing ? { ...existing, ...mc } : mc;
      });
    }

    if (modified.notes?.internal !== undefined) {
      updated.notes = { ...updated.notes, internal: modified.notes.internal };
      changes.push(`Note interne modificate`);
    }
    if (modified.notes?.clientVisible !== undefined) {
      updated.notes = { ...updated.notes, clientVisible: modified.notes.clientVisible };
      changes.push(`Note per il cliente modificate`);
    }
    if (modified.issuer) {
      updated.issuer = { ...updated.issuer, ...modified.issuer };
      if (modified.issuer.name) changes.push(`Emittente: "${modified.issuer.name}"`);
      if (modified.issuer.email) changes.push(`Email emittente: ${modified.issuer.email}`);
    }
    if (modified.paymentTerms) {
      const pt = modified.paymentTerms;
      updated.paymentTerms = { ...updated.paymentTerms };
      if (pt.paymentMethod !== undefined) { updated.paymentTerms.paymentMethod = pt.paymentMethod; changes.push(`Metodo pagamento: ${pt.paymentMethod}`); }
      if (pt.paymentSchedule !== undefined) { updated.paymentTerms.paymentSchedule = pt.paymentSchedule; changes.push(`Scadenze pagamento: ${pt.paymentSchedule.length} tranche`); }
      if (pt.latePaymentInterest !== undefined) { updated.paymentTerms.latePaymentInterest = pt.latePaymentInterest; changes.push(`Interessi ritardato pagamento aggiornati`); }
      if (pt.iban !== undefined) { updated.paymentTerms.iban = pt.iban; changes.push(`IBAN aggiornato`); }
      if (pt.bic !== undefined) { updated.paymentTerms.bic = pt.bic; changes.push(`BIC aggiornato`); }
    }
    if (modified.status) { updated.status = modified.status; changes.push(`Stato: ${modified.status}`); }
    if (modified.validUntil) { updated.validUntil = modified.validUntil; changes.push(`Valido fino al: ${modified.validUntil}`); }
    if (modified.currency) { updated.currency = modified.currency; changes.push(`Valuta: ${modified.currency}`); }
    if (modified.locale) { updated.locale = modified.locale; changes.push(`Localizzazione: ${modified.locale}`); }
    if (modified.attachments) { updated.attachments = modified.attachments; changes.push(`Allegati aggiornati`); }
    if (modified.uiPreferences) {
      updated.uiPreferences = { ...updated.uiPreferences, ...modified.uiPreferences };
      const uiChanges: string[] = [];
      if (modified.uiPreferences.templateId) uiChanges.push(`template: ${modified.uiPreferences.templateId}`);
      if (modified.uiPreferences.accentColor) uiChanges.push(`colore: ${modified.uiPreferences.accentColor}`);
      if (modified.uiPreferences.fontFamily) uiChanges.push(`font: ${modified.uiPreferences.fontFamily}`);
      if (modified.uiPreferences.showLogo !== undefined) uiChanges.push(`logo: ${modified.uiPreferences.showLogo ? 'sì' : 'no'}`);
      if (modified.uiPreferences.showTotalsPerOption !== undefined) uiChanges.push(`totali opzione: ${modified.uiPreferences.showTotalsPerOption ? 'sì' : 'no'}`);
      if (modified.uiPreferences.showGlobalTotals !== undefined) uiChanges.push(`totali globali: ${modified.uiPreferences.showGlobalTotals ? 'sì' : 'no'}`);
      if (uiChanges.length > 0) changes.push(`Preferenze UI: ${uiChanges.join(', ')}`);
    }

    updated.updatedAt = new Date().toISOString();
    return { quote: updated, changes };
  };

  const SYSTEM_PROMPT = `Sei un assistente AI per la creazione di preventivi professionali.
Il tuo compito è modificare il JSON del preventivo in base alla richiesta dell'utente.

CAMPI DISPONIBILI (puoi modificare qualsiasi campo):
- project.title, project.description, project.code, project.startDate, project.endDate
- client.name, client.contactPerson, client.address, client.email, client.phone, client.vatNumber, client.taxCode, client.notes
- issuer.name, issuer.email, issuer.vatNumber, issuer.taxCode, issuer.address, issuer.phone, issuer.website
- options[{id, label, description, isDefault, selectionType, items[{id, label, description, category, unit, quantity, unitPrice, discount, tax}]}]
- paymentTerms.paymentMethod, paymentTerms.paymentSchedule[{label, dueDaysFromIssue, percentage, notes}], paymentTerms.latePaymentInterest, paymentTerms.iban, paymentTerms.bic
- legalClauses[{id, title, body}]
- uiPreferences.templateId, uiPreferences.accentColor, uiPreferences.fontFamily, uiPreferences.showLogo, uiPreferences.showTotalsPerOption, uiPreferences.showGlobalTotals
- notes.internal, notes.clientVisible
- status, validUntil, currency, locale
- Puoi AGGIUNGERE nuove opzioni, item e clausole (usa un nuovo ID formato da "opt_xxx", "item_xxx", "cl_xxx")
- Puoi RIMUOVERE opzioni, item e clausole esistenti (toglili dall'array)

REGOLE IMPORTANTI:
1. Mantieni SEMPRE gli ID esistenti di opzioni, item e clausole (tranne quando ne aggiungi di nuovi)
2. Non modificare i campi 'total' (net, tax, gross) — li calcola il sistema
3. Non modificare i campi 'summary' e 'globalTotals' — li calcola il sistema
4. Per i costi numerici, modifica solo unitPrice e quantity
5. Per sconti: modifica discount.type ("percentage"/"absolute"/"none") e discount.value
6. Usa [WARNING]...[/WARNING] e [INFO]...[/INFO] nei testi per callout visivi
7. Non inventare prezzi se non richiesto
8. Rispondi SOLO con JSON valido contenente SOLO i campi da modificare
9. Se la richiesta è in italiano, rispondi in italiano nei testi
10. Se l'utente chiede di ricalcolare acconti/tranche, modifica paymentTerms.paymentSchedule

TOOL DISPONIBILI (il sistema li applica automaticamente dal prompt dell'utente):
- "sconto X%" → applica sconto percentuale
- "margine X%" → ricalcola prezzi con margine target
- "duplica" → duplica la prima opzione
- "ricalcola" → ricalcola tutti i totali
- "riordina" → riordina opzioni per prezzo/nome
- "rimuovi vuoti" → elimina voci con costo zero
- "unisci duplicate" → merge voci identiche
- "arrotonda X" → arrotonda prezzi al multiplo di X
- "annuale" → calcola costo annuale per voci mensili
- "verifica" / "controlla" → controlla coerenza totali
- "riassunto" → genera riepilogo testuale
- "traduci [lingua]" → traduci il documento
- "migliora descrizioni" → riscrivi descrizioni in modo professionale

Quando l'utente chiede una di queste operazioni, concentrati sulle MODIFICHE DI TESTO (titoli, descrizioni, clausole, paymentTerms) e il sistema applicherà i tool numerici automaticamente.`;

  const callDeepSeek = async (userPrompt: string): Promise<any> => {
    const profile = await dataService.getUserProfile(user?.email);
    if (profile.error) throw new Error(profile.error);
    if (profile.tokensUsed >= profile.tokenLimit) {
      throw new Error('Limite token AI raggiunto. Contatta l\'amministratore.');
    }

    addLog('info', `→ DeepSeek [${aiModel}] invio...`);
    addLog('info', `Prompt: "${userPrompt.substring(0, 80)}..."`);

    const result = await dataService.chatWithAI({
      model: aiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Preventivo attuale (JSON):\n${JSON.stringify(quote, null, 2)}\n\nRichiesta: ${userPrompt}\n\nRispondi SOLO con il JSON delle modifiche da applicare. Nessun testo extra, nessun markdown, solo JSON puro.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    if (result.error) {
      addLog('error', `DeepSeek: ${result.error}`);
      throw new Error(result.error);
    }

    const tokensUsed = result.usage?.total_tokens || 0;
    if (user?.email) dataService.trackTokens(user.email, tokensUsed);
    addLog('info', `Token: ${tokensUsed}`);

    let raw = result.choices[0].message.content;
    raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    addLog('success', `Risposta (${raw.length} chars): ${raw.substring(0, 120)}...`);
    return JSON.parse(raw);
  };

  const applyToolByKeyword = (prompt: string, currentQuote: PremiumQuote): PremiumQuote => {
    let q = { ...currentQuote };
    const lowerPrompt = prompt.toLowerCase();
    let changes: string[] = [];

    if (lowerPrompt.includes('sconto') || lowerPrompt.includes('discount')) {
      const match = lowerPrompt.match(/(\d+)\s*%/);
      const pct = match ? parseInt(match[1]) : 10;
      const scopeMatch = lowerPrompt.match(/(opzione|option)\s*(\d+)/);
      const scope = scopeMatch ? 'option' : 'all';
      const result = applyDiscount(q, {
        type: 'percentage',
        value: pct,
        scope,
        ...(scope === 'option' ? { optionIds: [q.options[parseInt(scopeMatch![2]) - 1]?.id].filter(Boolean) as string[] } : {}),
      });
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('margine') || lowerPrompt.includes('margin')) {
      const match = lowerPrompt.match(/(\d+)\s*%/);
      const target = match ? parseInt(match[1]) : 30;
      const result = adjustMargin(q, target);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('duplica') || lowerPrompt.includes('duplicate') || lowerPrompt.includes('copia')) {
      if (q.options.length > 0) {
        const result = duplicateOption(q, q.options[0].id);
        q = result.quote;
        changes.push(result.changes);
      }
    }

    if (lowerPrompt.includes('ricalcola') || lowerPrompt.includes('recalculate')) {
      const result = recalculateTotals(q);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('riordina') || lowerPrompt.includes('reorder') || lowerPrompt.includes('ordina')) {
      let sortBy: 'price_asc' | 'price_desc' | 'name' = 'price_asc';
      if (lowerPrompt.includes('decresc') || lowerPrompt.includes('alto') || lowerPrompt.includes('maggior')) sortBy = 'price_desc';
      if (lowerPrompt.includes('nome') || lowerPrompt.includes('alpha')) sortBy = 'name';
      const result = reorderOptions(q, sortBy);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('rimuovi') && (lowerPrompt.includes('vuot') || lowerPrompt.includes('zero') || lowerPrompt.includes('empty'))) {
      const result = removeEmptyItems(q);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('unisci') && (lowerPrompt.includes('duplicat') || lowerPrompt.includes('doppie') || lowerPrompt.includes('identiche'))) {
      const result = mergeDuplicateItems(q);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('arrotonda') || lowerPrompt.includes('round')) {
      const match = lowerPrompt.match(/(\d+)/);
      const nearest = match ? parseInt(match[1]) : 5;
      const result = roundPrices(q, nearest);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('annuale') || lowerPrompt.includes('annual') || lowerPrompt.includes('12 mesi') || lowerPrompt.includes('yearly')) {
      const result = calculateAnnualCost(q);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('coeren') || lowerPrompt.includes('verific') || lowerPrompt.includes('consist') || lowerPrompt.includes('check')) {
      const result = checkConsistency(q);
      q = result.quote;
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('riassunto') || lowerPrompt.includes('sommario') || lowerPrompt.includes('summary')) {
      const result = generateSummary(q);
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('valida') || lowerPrompt.includes('validat') || lowerPrompt.includes('controlla')) {
      const result = validateQuoteTool(q);
      changes.push(result.changes);
    }

    if (lowerPrompt.includes('traduci') || lowerPrompt.includes('translate')) {
      const langMatch = lowerPrompt.match(/(english|inglese|spanish|spagnolo|french|francese|german|tedesco|portoghese)/);
      const langMap: Record<string, string> = { english: 'en', inglese: 'en', spanish: 'es', spagnolo: 'es', french: 'fr', francese: 'fr', german: 'de', tedesco: 'de', portoghese: 'pt' };
      const lang = langMatch ? langMap[langMatch[1]] || 'en' : 'en';
      const result = translateQuotePrompt(q, lang);
      changes.push(`Traduzione richiesta in ${lang} (verrà eseguita dall'AI).`);
    }

    if (lowerPrompt.includes('migliora') && (lowerPrompt.includes('descrizion') || lowerPrompt.includes('testo') || lowerPrompt.includes('enhance'))) {
      const result = enhanceDescriptionsPrompt(q);
      changes.push(`Miglioramento descrizioni richiesto (verrà eseguito dall'AI).`);
    }

    q = recalculateTotals(q).quote;

    if (changes.length > 0) {
      addLog('success', `Tool automatici (${changes.length}):`);
      changes.forEach((c) => addLog('info', `  ⚙ ${c}`));
    }

    return q;
  };

  const runAI = async (mode = "custom") => {
    const prompt = aiText.trim();
    if (!prompt && mode === "custom") { setActivity("💡 Scrivi un prompt per l'AI."); return; }

    addLog('info', `▶ runAI [${mode}] "${prompt.substring(0, 80)}..."`);
    setActivity("🤖 Chiamata DeepSeek in corso...");
    try {
      const prompts: Record<string, string> = {
        premium: "Rendi il preventivo premium: descrizioni più esclusive, colore accattivante, titolo con 'Edizione Premium'.",
        faq: "Aggiungi una clausola 'FAQ cliente' con domande frequenti su tempi, revisioni, proprietà dei file e supporto. Mantieni le clausole esistenti.",
        discount: "Applica uno sconto del 10% su tutti i costi una tantum delle opzioni.",
        simple: "Semplifica il documento: riduci le descrizioni delle opzioni all'essenziale, mantieni solo le prime 2 clausole.",
        custom: prompt,
      };
      const userPrompt = prompts[mode] || prompt;
      addLog('info', `Prompt inviato all'AI (${userPrompt.length} chars)`);

      const reply = await callDeepSeek(userPrompt);

      let aiChanges: string[] = [];
      setQuote((currentQuote) => {
        const { quote: merged, changes } = mergeAIResponse(currentQuote, reply);
        aiChanges = changes;
        return applyToolByKeyword(userPrompt, merged);
      });
      markDirty();

      if (aiChanges.length > 0) {
        addLog('success', `AI modifiche (${aiChanges.length}):`);
        aiChanges.forEach((c) => addLog('info', `  • ${c}`));
      } else {
        addLog('info', 'AI: nessuna modifica testuale applicata');
      }

      const toolMsg = userPrompt !== prompt ? ' + tool automatici' : '';
      setActivity(`✅ AI: ${mode === "custom" ? "prompt applicato" : mode}${toolMsg} con successo.`);
      addLog('success', `Preventivo aggiornato${toolMsg}`);
      addToast('success', `AI: ${mode === "custom" ? "prompt applicato" : mode}${toolMsg}`);
    } catch (err: any) {
      const hint = err.message?.includes('402') ? 'Credito DeepSeek esaurito.' :
        err.message?.includes('401') ? 'Chiave API DeepSeek non valida.' :
        err.message?.includes('429') ? 'Troppe richieste. Attendi e riprova.' :
        err.message?.includes('fetch') || err.message?.includes('NetworkError') ? 'Connessione fallita.' : null;
      setActivity(`❌ ${hint || err.message}`);
      addLog('error', hint || err.message);
      addToast('error', hint || err.message);
    }
  };

  const saveQuote = () => setShowSaveDialog(true);

  const persistQuote = (q: PremiumQuote) => {
    const legacy = toLegacyFormat(q);
    setQuotes((c: any[]) => {
      const updated = [legacy, ...c.filter((qq: any) => qq.id !== q.quoteId)];
      if (user?.email) dataService.saveQuote(user.email, legacy);
      return updated;
    });
    setPremiumQuotes((c) => {
      const updated = [q, ...c.filter((pq) => pq.quoteId !== q.quoteId)];
      return updated;
    });
  };

  const handleQuickSave = () => {
    const saved = { ...quote, project: { ...quote.project, title: `${quote.project.title} (auto)` } };
    persistQuote(saved);
    setIsDirty(false);
    setLastSaveTime(new Date());
    setActivity('Preventivo salvato automaticamente.');
    addToast('success', 'Preventivo salvato');
  };

  const handleSaveConfirmed = (customName: string) => {
    setShowSaveDialog(false);
    const saved = { ...quote, project: { ...quote.project, title: customName } };
    persistQuote(saved);
    setIsDirty(false);
    setLastSaveTime(new Date());
    setActivity(`Preventivo "${customName}" salvato.`);
    addToast('success', `"${customName}" salvato`);
  };

  const duplicate = (saved: any) => {
    const now = new Date().toISOString();
    const copy = migrateFromLegacy({ ...saved, id: generateId(), status: 'Bozza', date: now.slice(0, 10), title: `${saved.title} (copia)` });
    setPremiumQuotes((c) => {
      const updated = [copy, ...c];
      if (user?.email) dataService.saveQuote(user.email, toLegacyFormat(copy));
      return updated;
    });
    setQuote(copy);
    setView("editor");
    setIsDirty(true);
    addToast('success', 'Preventivo duplicato');
  };

  const saveAsTemplate = () => {
    const template = { ...quote, quoteId: generateId(), client: { ...quote.client, name: '' } };
    persistQuote({ ...template, quoteId: generateId() });
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

  const toggleShare = (enabled: boolean) => {
    if (enabled) {
      const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setQuote((c) => ({ ...c, shareToken: token }));
    }
  };

  const shareInfo = quote.quoteId ? {
    link: `${window.location.origin}/preventivo/${quote.quoteId}`,
    token: quote.quoteId,
  } : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.key === 's') { e.preventDefault(); handleQuickSave(); }
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
    setActivity(`${saved.id} aperto in modifica.`);
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
    setActivity("Generazione PDF in corso...");
    try {
      const { default: generatePDF } = await import('./src/utils/generatePDF');
      generatePDF(quote, documentTheme);
      setActivity("PDF esportato con successo!");
      addToast('success', 'PDF esportato');
    } catch (err) {
      console.error(err);
      setActivity("Errore esportazione PDF.");
      addToast('error', 'Errore esportazione PDF');
    }
    setPdfLoading(false);
  };

  const exportDOCX = async () => {
    setDocxLoading(true);
    setActivity("Generazione DOCX in corso...");
    try {
      await generateDOCX(quote, documentTheme);
      setActivity("DOCX esportato con successo!");
      addToast('success', 'DOCX esportato');
    } catch (err) {
      console.error(err);
      setActivity("Errore esportazione DOCX.");
      addToast('error', 'Errore esportazione DOCX');
    }
    setDocxLoading(false);
  };

  const handlePdfImport = (importedQuote: PremiumQuote) => {
    setQuote(importedQuote);
    setShowPdfImport(false);
    setIsDirty(true);
    setActivity(`Preventivo importato da PDF: ${importedQuote.project?.title}`);
    addToast('success', 'PDF importato con successo');
  };

  return (
    <AppContext.Provider value={{ editingQuote: quote, setEditingQuote: setQuote, saveQuote, quotes }}>
      <GlobalStyles />
      <Layout view={view} setView={setView} onLogout={logout} user={user} theme={theme} setTheme={setTheme}>
        <Topbar
          view={view}
          onSave={saveQuote}
          onExportPDF={exportPDF}
          onExportDOCX={exportDOCX}
          onImportPDF={() => setShowPdfImport(true)}
          lastSaveTime={lastSaveTime}
          isDirty={isDirty}
          pdfLoading={pdfLoading}
          docxLoading={docxLoading}
          onSaveAsTemplate={saveAsTemplate}
          theme={theme}
          setTheme={setTheme}
          documentTheme={documentTheme}
          onDocumentThemeChange={(t) => setDocumentTheme(t)}
        />
        {view === "settings" ? (
          <SettingsPage />
        ) : view === "editor" ? (
          <EditorView
            quote={quote}
            aiText={aiText}
            setAiText={setAiText}
            activity={activity}
            patch={patch}
            updateOption={updateOption}
            updateOptions={updateOptions}
            addOption={addOption}
            removeOption={removeOption}
            updateClause={updateClause}
            addClause={addClause}
            removeClause={removeClause}
            runAI={runAI}
            aiModel={aiModel}
            setAiModel={setAiModel}
            previewRef={previewRef}
            aiLogs={aiLogs}
            isDirty={isDirty}
            saveQuote={handleQuickSave}
            shareInfo={shareInfo}
            toggleShare={toggleShare}
            documentTheme={documentTheme}
          />
        ) : view === "admin" ? (
          <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
            <AdminDashboard />
          </Suspense>
        ) : (
          <Suspense fallback={<CollectionViewSkeleton />}>
            <CollectionView
              quotes={quotes}
              activeId={quote.quoteId}
              openQuote={openQuote}
              duplicate={duplicate}
              removeQuote={(id: string) => {
                setQuotes((c: any[]) => c.filter((q: any) => q.id !== id));
                if (user?.email) dataService.deleteQuote(id, user.email);
              }}
              onUpdateStatus={updateQuoteStatus}
              onDeleteRequest={(item: any) => setDeleteTarget(item)}
              setView={setView}
              createFromTemplate={createFromTemplate}
            />
          </Suspense>
        )}
      </Layout>
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
            const reply = await callDeepSeek(prompt);
            return JSON.stringify(reply);
          }}
        />
      )}
    </AppContext.Provider>
  );
}


