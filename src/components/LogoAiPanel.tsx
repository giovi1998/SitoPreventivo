import React, { useState, useEffect, useCallback } from 'react';
import type { Logo, LogoBuilder, LogoSector } from '../utils/documentSchemas';
import { builderToSvg, sanitizeSvg } from '../utils/logoGenerator';
import { useAILogo } from '../hooks/useAILogo';
import { useToast } from '../hooks/useToast';
import AILogPanel from './AILogPanel';
import './LogoAiPanel.css';

interface Props {
  logo: Logo;
  onPatch: (patch: Partial<Logo['builder']>) => void;
  tier: 'free' | 'unlocked';
  userEmail?: string;
}

const SECTORS: LogoSector[] = ['tech', 'food', 'fashion', 'professionista'];
const MOODS = ['minimal', 'bold', 'playful', 'elegant', 'tech'] as const;

const LS_KEY = 'logoAiChat:v1';
const LS_TTL_MS = 24 * 60 * 60 * 1000;
const PROMPT_LIBRARY_KEY = 'logoPromptLibrary:v1';

type Step = 'chat' | 'result' | 'applied';

interface ChatAnswers {
  activity: string;
  mood: string;
  target: string;
  sector: LogoSector;
}

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

function savePromptLibrary(items: SavedBrief[]): void {
  localStorage.setItem(PROMPT_LIBRARY_KEY, JSON.stringify(items));
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

function nowTime(): string {
  return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogoAiPanel({ logo, onPatch, tier, userEmail }: Props) {
  const { generate, generateBackground, isProcessing, isGeneratingBg, logs, reset } = useAILogo(userEmail);
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('chat');
  const [answers, setAnswers] = useState<ChatAnswers>({
    activity: '',
    mood: 'minimal',
    target: '',
    sector: 'tech',
  });
  const [concepts, setConcepts] = useState<LogoBuilder[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [bgImages, setBgImages] = useState<(string | null)[]>([null, null, null]);
  const [bgErrors, setBgErrors] = useState<(string | null)[]>([null, null, null]);
  const [config, setConfig] = useState<LogoConfig | null>(null);
  const [library, setLibrary] = useState<SavedBrief[]>(() => loadPromptLibrary());
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  // Load persisted state on mount
  useEffect(() => {
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
  }, []);

  // Persist state on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload: PersistedState = {
        answers,
        step,
        concepts,
        selected,
        bgImages,
        ts: Date.now(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, step, concepts, selected]);

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
      <section className="logo-ai-disabled" aria-label="AI Generation riservata">
        <div className="logo-ai-card" role="status">
          <h2>AI Generation</h2>
          <p>AI generation è disponibile nel piano Pro o con codice sblocco. Riscatta un codice in Impostazioni.</p>
        </div>
      </section>
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
    const patch = { ...concept };
    if (bgImages[idx]) {
      (patch as LogoBuilder).backgroundImage = bgImages[idx]!;
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
          <label>
            <span className="logo-ai-q">Cosa fa la tua attività?</span>
            <textarea
              value={answers.activity}
              onChange={(e) => setAnswers({ ...answers, activity: e.target.value.slice(0, 500) })}
              rows={3}
              placeholder="Es. Pizzeria moderna nel centro di Cagliari"
            />
          </label>
          <label>
            <span className="logo-ai-q">Settore</span>
            <select value={answers.sector} onChange={(e) => setAnswers({ ...answers, sector: e.target.value as LogoSector })}>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="button" className="logo-ai-preset-btn" onClick={applySectorExample}>
            Usa esempio {SECTOR_LABELS[answers.sector]}
          </button>
          <div className="logo-ai-mood">
            <span className="logo-ai-q">Che mood vuoi?</span>
            <div className="logo-ai-mood-options">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={answers.mood === m ? 'is-selected' : ''}
                  onClick={() => setAnswers({ ...answers, mood: m })}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span className="logo-ai-q">Chi è il tuo target?</span>
            <input
              type="text"
              value={answers.target}
              onChange={(e) => setAnswers({ ...answers, target: e.target.value.slice(0, 200) })}
              placeholder="Es. giovani 25-35, foodies"
            />
          </label>
          <div className="logo-ai-actions">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing || isGeneratingBg || !canGenerate}
            >
              {isProcessing ? 'Generando concept…' : isGeneratingBg ? 'Generando background…' : 'Genera 3 concept'}
            </button>
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
                bgLoading={isGeneratingBg && !bgImages[i] && !bgErrors[i]}
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
        aria-pressed={selected}
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
