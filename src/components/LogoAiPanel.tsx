import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Logo, LogoBuilder, LogoSector } from '../utils/documentSchemas';
import { builderToSvg, sanitizeSvg } from '../utils/logoGenerator';
import { useAILogo } from '../hooks/useAILogo';
import { useToast } from '../hooks/useToast';
import AILogPanel from './AILogPanel';
import {
  AiTierGuard,
  AiPromptTextarea,
  AiSelect,
  AiGenerateButton,
  AiActionChip,
  AiActionGrid,
} from './ai-ui';
import './LogoAiPanel.css';

export type Step = 'chat' | 'result' | 'applied';

export interface ChatAnswers {
  activity: string;
  mood: string;
  target: string;
  sector: LogoSector;
}

/**
 * Stato completo del pannello AI (chat + concept + immagini generate).
 * Va sollevato al genitore (`LogoEditor`) tramite `initialState` /
 * `onStateChange` in modo che sopravviva allo smontaggio di
 * `LogoAiPanel` quando l'utente cambia tab (Builder <-> AI). Prima di
 * questa modifica lo stato viveva SOLO qui dentro + un backup su
 * `localStorage`, ma le immagini AI (base64, centinaia di KB l'una)
 * possono superare la quota di `localStorage` (5-10MB per origin,
 * condivisa con altri documenti salvati) e `localStorage.setItem` non
 * era protetto da try/catch: un `QuotaExceededError` non catturato
 * crashava l'intera app (schermata "Qualcosa è andato storto"). Vedi
 * AGENTS.md § "Logo AI, Gemini background gotchas".
 */
export interface LogoAiState {
  answers: ChatAnswers;
  step: Step;
  concepts: LogoBuilder[];
  selected: number;
  bgImages: (string | null)[];
  bgErrors: (string | null)[];
}

interface Props {
  logo: Logo;
  onPatch: (patch: Partial<Logo['builder']>) => void;
  tier: 'free' | 'unlocked';
  userEmail?: string;
  /** Stato iniziale sollevato dal genitore (sopravvive al cambio tab). */
  initialState?: LogoAiState;
  /** Chiamato ad ogni cambio di stato per sincronizzare il genitore. */
  onStateChange?: (state: LogoAiState) => void;
}

const SECTORS: LogoSector[] = ['tech', 'food', 'fashion', 'professionista'];
const MOODS = ['minimal', 'bold', 'playful', 'elegant', 'tech'] as const;

const LS_KEY = 'logoAiChat:v1';
const LS_TTL_MS = 24 * 60 * 60 * 1000;
const PROMPT_LIBRARY_KEY = 'logoPromptLibrary:v1';

const SECTOR_LABELS: Record<LogoSector, string> = {
  tech: 'Tech',
  food: 'Food',
  fashion: 'Fashion',
  professionista: 'Professionista',
};

/**
 * Piano B (prompt templates): un esempio pronto per settore, per far
 * partire velocemente la generazione o mostrare all'utente cosa
 * scrivere. L'utente può poi modificare liberamente i campi.
 */
const SECTOR_PRESET_BRIEFS: Record<LogoSector, { activity: string; mood: (typeof MOODS)[number]; target: string }> = {
  tech: {
    activity: 'Startup SaaS per la gestione di progetti in team remoti, con dashboard e integrazioni.',
    mood: 'tech',
    target: 'startup e team di sviluppo software',
  },
  food: {
    activity: 'Pizzeria napoletana artigianale nel centro città, forno a legna e ingredienti locali.',
    mood: 'bold',
    target: 'famiglie e giovani 20-40 anni',
  },
  fashion: {
    activity: 'Atelier di moda sostenibile con capi su misura, tessuti naturali e produzione etica.',
    mood: 'elegant',
    target: 'donne 25-45 anni attente allo stile',
  },
  professionista: {
    activity: 'Studio di consulenza legale specializzato in diritto del lavoro e contrattualistica.',
    mood: 'minimal',
    target: 'aziende e piccole-medie imprese',
  },
};

interface SavedBrief extends ChatAnswers {
  id: string;
  label: string;
  createdAt: number;
}

function loadPromptLibrary(): SavedBrief[] {
  try {
    const raw = localStorage.getItem(PROMPT_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Wrapper difensivo su `localStorage.setItem`: non deve MAI propagare
 * un'eccezione (es. `QuotaExceededError` quando il payload contiene
 * immagini base64 di centinaia di KB). Senza questo guard, un errore
 * di quota non catturato fa crashare l'intera app (bug reale
 * osservato in produzione: schermata "Qualcosa è andato storto").
 */
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[LogoAiPanel] localStorage.setItem('${key}') fallito`, (err as Error)?.message);
    return false;
  }
}

function savePromptLibrary(items: SavedBrief[]): void {
  safeLocalStorageSet(PROMPT_LIBRARY_KEY, JSON.stringify(items));
}

interface LogoConfig {
  enabled: boolean;
  provider: 'gemini' | 'replicate' | 'none';
}

interface PersistedState {
  answers: ChatAnswers;
  step: Step;
  concepts: LogoBuilder[];
  selected: number;
  bgImages: (string | null)[];
  ts: number;
}

/**
 * Scrive lo stato su `localStorage`, mai a costo zero: le immagini AI
 * (base64, centinaia di KB l'una × fino a 3 concept) possono superare
 * la quota di `localStorage` (5-10MB/origin, condivisa con altri
 * documenti salvati). Se il payload completo fallisce, ritentiamo
 * SENZA `bgImages` così testo/risposte/concept sopravvivono comunque a
 * un refresh pagina; le immagini restano disponibili nella sessione
 * corrente tramite lo stato sollevato al genitore (`onStateChange` /
 * `LogoEditor`), quindi l'utente non le perde finché non ricarica la
 * pagina per intero.
 */
function persistState(payload: PersistedState): void {
  const ok = safeLocalStorageSet(LS_KEY, JSON.stringify(payload));
  if (!ok) {
    safeLocalStorageSet(LS_KEY, JSON.stringify({ ...payload, bgImages: payload.bgImages.map(() => null) }));
  }
}

function nowTime(): string {
  return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const DEFAULT_ANSWERS: ChatAnswers = { activity: '', mood: 'minimal', target: '', sector: 'tech' };

export default function LogoAiPanel({ logo, onPatch, tier, userEmail, initialState, onStateChange }: Props) {
  const { generate, generateBackground, isProcessing, isGeneratingBg, logs, reset } = useAILogo(userEmail);
  const { addToast } = useToast();
  // Se il genitore (LogoEditor) fornisce `initialState`, lo stato vive
  // sollevato in un useRef lì e sopravvive allo smontaggio di questo
  // componente quando l'utente cambia tab (Builder <-> AI). Senza
  // questo, ogni cambio di tab smonta/rimonta LogoAiPanel e perde le
  // immagini AI generate ma non ancora persistite su localStorage
  // (bug reale: "immagine sparisce cambiando tab"). Il fallback su
  // localStorage resta solo per il caso senza genitore che solleva lo
  // stato (retrocompatibilità test / primo mount senza sessione).
  const [step, setStep] = useState<Step>(initialState?.step ?? 'chat');
  const [answers, setAnswers] = useState<ChatAnswers>(initialState?.answers ?? DEFAULT_ANSWERS);
  const [concepts, setConcepts] = useState<LogoBuilder[]>(initialState?.concepts ?? []);
  const [selected, setSelected] = useState<number>(initialState?.selected ?? -1);
  const [bgImages, setBgImages] = useState<(string | null)[]>(initialState?.bgImages ?? [null, null, null]);
  const [bgErrors, setBgErrors] = useState<(string | null)[]>(initialState?.bgErrors ?? [null, null, null]);
  const [config, setConfig] = useState<LogoConfig | null>(null);
  const [library, setLibrary] = useState<SavedBrief[]>(() => loadPromptLibrary());
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  // Load persisted state on mount — SOLO se il genitore non ha già
  // fornito uno stato più fresco via `initialState` (vedi sopra).
  useEffect(() => {
    if (initialState) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed.ts && Date.now() - parsed.ts < LS_TTL_MS) {
          setAnswers(parsed.answers);
          setStep(parsed.step);
          if (parsed.concepts?.length) setConcepts(parsed.concepts);
          if (typeof parsed.selected === 'number') setSelected(parsed.selected);
          if (Array.isArray(parsed.bgImages)) setBgImages(parsed.bgImages);
        } else {
          localStorage.removeItem(LS_KEY);
        }
      }
    } catch {
      localStorage.removeItem(LS_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Specchia lo stato nel genitore (LogoEditor) ad OGNI cambiamento,
  // senza debounce: è una semplice assegnazione di riferimento a un
  // useRef del genitore (nessun costo, nessuna serializzazione), quindi
  // non c'è motivo di ritardarla. Questo è il meccanismo primario che
  // fa sopravvivere le immagini AI al cambio tab, indipendentemente da
  // localStorage/quota.
  useEffect(() => {
    onStateChange?.({ answers, step, concepts, selected, bgImages, bgErrors });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, step, concepts, selected, bgImages, bgErrors]);

  // Persist state on change (debounced) su localStorage, MA con flush
  // immediato all'unmount. Questo resta solo un backup "best effort"
  // per sopravvivere a un refresh completo della pagina (F5): il
  // meccanismo primario anti-perdita-immagine durante il cambio tab è
  // lo stato sollevato al genitore sopra, non più questo localStorage.
  //
  // Bug fix (costoso, ogni rigenerazione consuma una chiamata Gemini a
  // pagamento): il debounce di 500ms usava solo `clearTimeout` nella
  // cleanup. Se l'utente cambiava tab (Builder <-> AI, che smonta
  // LogoAiPanel) ENTRO i 500ms dall'arrivo di un'immagine AI, il timer
  // veniva cancellato e il salvataggio non avveniva mai. `latestStateRef`
  // tiene sempre l'ultimo stato pronto; l'effect con deps [] flusha
  // quello stato alla vera unmount, indipendentemente dal debounce.
  const latestStateRef = useRef<PersistedState>({ answers, step, concepts, selected, bgImages, ts: 0 });
  useEffect(() => {
    latestStateRef.current = { answers, step, concepts, selected, bgImages, ts: Date.now() };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      persistState(latestStateRef.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, step, concepts, selected, bgImages]);

  useEffect(() => {
    return () => {
      persistState(latestStateRef.current);
    };
  }, []);

  useEffect(() => {
    fetch('/api/ai/logo-config')
      .then((r) => r.json())
      .then((c: LogoConfig) => {
        setConfig(c);
        if (c.provider === 'gemini') {
          // eslint-disable-next-line no-console
          console.log(`[Logo AI] Config attiva: ${c.provider} · ${nowTime()}`);
        }
      })
      .catch(() => setConfig({ enabled: false, provider: 'none' }));
  }, []);

  if (tier === 'free') {
    return (
      <AiTierGuard 
        tier="free" 
        featureName="AI Generation" 
        fallbackMessage="AI generation è disponibile nel piano Pro o con codice sblocco. Riscatta un codice in Impostazioni."
      >
        {null}
      </AiTierGuard>
    );
  }

  const canGenerate = answers.activity.trim().length > 2 && answers.target.trim().length > 2;

  const handleGenerate = async () => {
    if (!canGenerate) {
      addToast('info', 'Compila almeno attività e target (3+ caratteri).');
      return;
    }
    try {
      const brief = [
        `Attività: ${answers.activity}`,
        `Mood: ${answers.mood}`,
        `Target: ${answers.target}`,
        `Settore: ${answers.sector}`,
      ].join('. ');
      addToast('info', 'Generazione 3 concept logo...');
      const result = await generate(logo, brief, { sector: answers.sector });
      if (!result.applied || !result.concepts.length) {
        addToast('error', 'AI non ha restituito concept validi. Riprova con una descrizione più dettagliata.');
        return;
      }
      const hasContent = result.concepts.some((b) => !!(b.primaryText || b.tagline || b.iconType !== 'none'));
      if (!hasContent) {
        addToast('error', 'AI ha restituito concept vuoti. Riprova con una descrizione più specifica.');
        return;
      }
      setConcepts(result.concepts);
      setSelected(-1);
      setStep('result');
      addToast('success', `${result.concepts.length} concept generati. Scegli quello che preferisci.`);

      // Genera 3 immagini Gemini in parallelo (una per concept)
      if (config?.provider === 'gemini') {
        addToast('info', 'Generazione 3 immagini AI in parallelo...');
        setBgImages([null, null, null]);
        setBgErrors([null, null, null]);
        const results = await Promise.allSettled(
          result.concepts.map((concept, i) => {
            const ctxBase = {
              activity: answers.activity,
              mood: answers.mood,
              target: answers.target,
              imagePrompt: (concept as any).imagePrompt as string | undefined,
            };
            return generateBackground({ ...logo, builder: concept }, ctxBase).then((r) => ({ idx: i, r }));
          }),
        );
        const imgs: (string | null)[] = [null, null, null];
        const errs: (string | null)[] = [null, null, null];
        let ok = 0;
        for (const res of results) {
          if (res.status === 'fulfilled') {
            const { idx, r } = res.value;
            if (r.applied && r.logo?.builder.backgroundImage) {
              imgs[idx] = r.logo.builder.backgroundImage;
              ok++;
            } else {
              errs[idx] = r.error ?? 'unknown';
            }
          } else {
            // idx non disponibile qui; mark all failures generically
          }
        }
        setBgImages(imgs);
        setBgErrors(errs);
        if (ok > 0) {
          addToast('success', `${ok}/3 immagini AI generate. Clicca un concept per applicarlo.`);
        } else {
          addToast('error', 'Nessuna immagine AI generata. Verifica GEMINI_API_KEY.');
        }
      } else if (config?.provider === 'none') {
        addToast('info', 'Immagini AI disabilitate. Configura GEMINI_API_KEY per attivarle.');
      }
    } catch (err) {
      addToast('error', 'Errore AI: ' + ((err as Error)?.message ?? 'unknown'));
    }
  };

  const applyConcept = async (idx: number) => {
    const concept = concepts[idx];
    if (!concept) return;
    setSelected(idx);
    // Bug fix v2.4.1: il concept generato da DeepSeek contiene sempre
    // backgroundImage=null. Se lo spreadiamo così com'è, onPatch sovrascrive
    // il background pagato (Gemini) dell'utente con null. Rimuoviamo
    // backgroundImage dal patch di default e lo impostiamo SOLO quando
    // bgImages[idx] è effettivamente pronto.
    const patch: Partial<LogoBuilder> = { ...concept };
    delete (patch as Partial<LogoBuilder>).backgroundImage;
    if (bgImages[idx]) {
      patch.backgroundImage = bgImages[idx]!;
      // Default per overlay: icona 'none' + decorazioni vuote
      // (l'utente può cambiarli nel Builder). Per above/below l'icona
      // è visibile perché il testo è fuori dall'area immagine.
      const curPos = logo?.builder?.textPosition;
      if (!curPos || curPos === 'overlay') {
        patch.iconType = 'none';
        patch.decorativeElements = [];
      }
    }
    onPatch(patch);
    addToast('success', 'Logo applicato. Vai nel Builder per modificare.');
    setStep('applied');
  };

  const handleReset = () => {
    setStep('chat');
    setAnswers({ activity: '', mood: 'minimal', target: '', sector: 'tech' });
    setConcepts([]);
    setSelected(-1);
    setBgImages([null, null, null]);
    setBgErrors([null, null, null]);
    reset();
    localStorage.removeItem(LS_KEY);
  };

  // ─── Piano B: preset per settore + libreria "I miei prompt" ──────

  const applySectorExample = () => {
    const preset = SECTOR_PRESET_BRIEFS[answers.sector];
    setAnswers({ ...answers, activity: preset.activity, mood: preset.mood, target: preset.target });
  };

  const saveBriefToLibrary = () => {
    const label = window.prompt('Nome per questo brief (es. "Pizzeria Cagliari"):');
    if (!label || !label.trim()) return;
    const entry: SavedBrief = {
      id: `brief_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: label.trim(),
      ...answers,
      createdAt: Date.now(),
    };
    const next = [...library, entry];
    setLibrary(next);
    savePromptLibrary(next);
    addToast('success', `Brief "${entry.label}" salvato.`);
  };

  const applyBrief = (brief: SavedBrief) => {
    setAnswers({ activity: brief.activity, mood: brief.mood, target: brief.target, sector: brief.sector });
  };

  const deleteBrief = (id: string) => {
    const next = library.filter((b) => b.id !== id);
    setLibrary(next);
    savePromptLibrary(next);
  };

  // ─── Piano B: rigenera background di un singolo concept con prompt editato ──

  const handleRegenerate = async (idx: number, promptText: string) => {
    const concept = concepts[idx];
    if (!concept) return;
    if (config?.provider !== 'gemini') {
      addToast('info', 'Immagini AI disabilitate. Configura GEMINI_API_KEY per attivarle.');
      return;
    }
    setRegeneratingIdx(idx);
    try {
      const ctx = {
        activity: answers.activity,
        mood: answers.mood,
        target: answers.target,
        imagePrompt: promptText,
      };
      const r = await generateBackground({ ...logo, builder: concept }, ctx);
      if (r.applied && r.logo?.builder.backgroundImage) {
        setBgImages((prev) => {
          const next = [...prev];
          next[idx] = r.logo!.builder.backgroundImage;
          return next;
        });
        setBgErrors((prev) => {
          const next = [...prev];
          next[idx] = null;
          return next;
        });
        addToast('success', `Concept ${idx + 1}: immagine rigenerata.`);
      } else {
        setBgErrors((prev) => {
          const next = [...prev];
          next[idx] = r.error ?? 'unknown';
          return next;
        });
        addToast('error', `Concept ${idx + 1}: rigenerazione fallita.`);
      }
    } finally {
      setRegeneratingIdx(null);
    }
  };

  return (
    <section className="logo-ai-panel" aria-label="AI Generation">
      <h2>AI Generation</h2>
      {config?.provider === 'gemini' && (
        <p className="logo-ai-provider">Powered by Gemini Nano Banana 2 Lite (background) + DeepSeek (parametri)</p>
      )}
      <p className="logo-ai-hint">
        Rispondi a 3 domande. L'AI propone 3 concept di logo + background artistico. Il testo resta
        vettoriale (SVG editabile nel Builder).
      </p>

      {step === 'chat' && (
        <div className="logo-ai-chat">
          <AiPromptTextarea
            label="Cosa fa la tua attività?"
            value={answers.activity}
            onChange={(e) => setAnswers({ ...answers, activity: e.target.value.slice(0, 500) })}
            rows={3}
            placeholder="Es. Pizzeria moderna nel centro di Cagliari"
          />
          <AiSelect
            label="Settore"
            value={answers.sector}
            onChange={(e) => setAnswers({ ...answers, sector: e.target.value as LogoSector })}
            options={SECTORS.map((s) => ({ value: s, label: s }))}
          />
          <button type="button" className="logo-ai-preset-btn" onClick={applySectorExample}>
            Usa esempio {SECTOR_LABELS[answers.sector]}
          </button>
          <div className="logo-ai-mood">
            <span className="logo-ai-q">Che mood vuoi?</span>
            <AiActionGrid>
              {MOODS.map((m) => (
                <AiActionChip
                  key={m}
                  label={m}
                  className={answers.mood === m ? 'is-selected' : ''}
                  onClick={() => setAnswers({ ...answers, mood: m })}
                />
              ))}
            </AiActionGrid>
          </div>
          <div className="logo-ai-target-wrapper">
            <span className="logo-ai-q">Chi è il tuo target?</span>
            <input
              type="text"
              value={answers.target}
              onChange={(e) => setAnswers({ ...answers, target: e.target.value.slice(0, 200) })}
              placeholder="Es. giovani 25-35, foodies"
            />
          </div>
          <div className="logo-ai-actions">
            <AiGenerateButton
              isProcessing={isProcessing || isGeneratingBg}
              loadingText={isProcessing ? 'Generando concept…' : 'Generando background…'}
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              Genera 3 concept
            </AiGenerateButton>
            <button type="button" onClick={handleReset} disabled={isProcessing || isGeneratingBg}>
              Reset chat
            </button>
          </div>

          <div className="logo-ai-library">
            <div className="logo-ai-library-header">
              <span className="logo-ai-q">I miei prompt</span>
              <button type="button" onClick={saveBriefToLibrary} disabled={!canGenerate}>
                💾 Salva questo brief
              </button>
            </div>
            {library.length === 0 ? (
              <p className="logo-ai-library-empty">Nessun prompt salvato ancora. Compila il form e salvalo per riusarlo in futuro.</p>
            ) : (
              <ul className="logo-ai-library-list">
                {library.map((b) => (
                  <li key={b.id} className="logo-ai-library-item">
                    <span className="logo-ai-library-label">{b.label}</span>
                    <div className="logo-ai-library-actions">
                      <button type="button" onClick={() => applyBrief(b)} aria-label={`Applica brief ${b.label}`}>
                        Applica
                      </button>
                      <button type="button" onClick={() => deleteBrief(b.id)} aria-label={`Elimina brief ${b.label}`}>
                        Elimina
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {(step === 'result' || step === 'applied') && (
        <div className="logo-ai-result">
          <p>{step === 'applied' ? 'Logo applicato. Modifica liberamente nel Builder.' : 'Scegli uno dei 3 concept generati.'}</p>
          <div className="logo-ai-concepts">
            {concepts.map((concept, i) => (
              <ConceptCard
                key={i}
                concept={concept}
                index={i}
                selected={selected === i}
                applied={step === 'applied' && selected === i}
                bgImage={bgImages[i]}
                bgError={bgErrors[i]}
                bgLoading={
                  regeneratingIdx === i ||
                  (isGeneratingBg && regeneratingIdx === null && !bgImages[i] && !bgErrors[i])
                }
                onSelect={() => applyConcept(i)}
                onRegenerate={(promptText) => handleRegenerate(i, promptText)}
                regenerating={regeneratingIdx === i}
              />
            ))}
          </div>
          <div className="logo-ai-result-actions">
            <button type="button" onClick={() => setStep('chat')} disabled={isProcessing || isGeneratingBg}>
              Genera altri 3
            </button>
            <button type="button" onClick={handleReset} disabled={isProcessing || isGeneratingBg}>
              Reset chat
            </button>
            <span className="logo-ai-tip">Vai nel tab Builder per modificare testo, icona e colori.</span>
          </div>
        </div>
      )}

      <AILogPanel logs={logs} isProcessing={isProcessing || isGeneratingBg} />
    </section>
  );
}

function ConceptCard({
  concept,
  index,
  selected,
  applied,
  bgImage,
  bgError,
  bgLoading,
  onSelect,
  onRegenerate,
  regenerating,
}: {
  concept: LogoBuilder;
  index: number;
  selected: boolean;
  applied: boolean;
  bgImage: string | null;
  bgError: string | null;
  bgLoading: boolean;
  onSelect: () => void;
  onRegenerate: (promptText: string) => void;
  regenerating: boolean;
}) {
  const [promptDraft, setPromptDraft] = useState(concept.imagePrompt || '');

  const previewSvg = React.useMemo(() => {
    try {
      const withBg = bgImage ? { ...concept, backgroundImage: bgImage } : concept;
      return sanitizeSvg(builderToSvg(withBg));
    } catch {
      return '';
    }
  }, [concept, bgImage]);

  return (
    <div className={`logo-ai-concept${selected ? ' is-selected' : ''}${applied ? ' is-applied' : ''}`}>
      <button
        type="button"
        className="logo-ai-concept-select"
        onClick={onSelect}
        disabled={bgLoading}
        aria-pressed={selected}
        aria-busy={bgLoading}
      >
        <div className="logo-ai-concept-preview">
          <div className="logo-ai-concept-preview-inner" dangerouslySetInnerHTML={{ __html: previewSvg }} />
          {bgLoading && (
            <div className="logo-ai-concept-loading" role="status" aria-live="polite">
              <span className="logo-ai-concept-spinner" aria-hidden="true" />
              <span className="logo-ai-concept-loading-text">Generazione sfondo…</span>
            </div>
          )}
        </div>
        <div className="logo-ai-concept-meta">
          <strong>Concept {index + 1}</strong>
          <span>{concept.primaryText}</span>
          <span>{concept.tagline}</span>
          <span className="logo-ai-concept-tags">
            {concept.iconType} · {concept.layout}
            {concept.decorativeElements?.length ? ` · ${concept.decorativeElements.join(', ')}` : ''}
            {concept.gradientFill ? ' · gradient' : ''}
          </span>
          {bgImage && <span className="logo-ai-concept-ai-badge">AI bg ✓</span>}
          {bgError && <span className="logo-ai-concept-ai-err">AI bg: {bgError}</span>}
        </div>
        {applied && <span className="logo-ai-concept-badge">Applicato</span>}
        {!selected && !applied && <span className="logo-ai-concept-cta">Seleziona</span>}
      </button>

      {concept.imagePrompt && (
        <details className="logo-ai-concept-advanced">
          <summary>Prompt avanzato</summary>
          <textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value.slice(0, 600))}
            rows={4}
            aria-label={`Prompt immagine concept ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onRegenerate(promptDraft)}
            disabled={regenerating || !promptDraft.trim()}
          >
            {regenerating ? 'Rigenerando…' : 'Rigenera immagine'}
          </button>
        </details>
      )}
    </div>
  );
}
