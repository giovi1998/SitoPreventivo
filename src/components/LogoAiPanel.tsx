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

type Step = 'chat' | 'result' | 'applied';

interface ChatAnswers {
  activity: string;
  mood: string;
  target: string;
  sector: LogoSector;
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
                onSelect={() => applyConcept(i)}
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
  onSelect,
}: {
  concept: LogoBuilder;
  index: number;
  selected: boolean;
  applied: boolean;
  bgImage: string | null;
  bgError: string | null;
  onSelect: () => void;
}) {
  const previewSvg = React.useMemo(() => {
    try {
      const withBg = bgImage ? { ...concept, backgroundImage: bgImage } : concept;
      return sanitizeSvg(builderToSvg(withBg));
    } catch {
      return '';
    }
  }, [concept, bgImage]);

  return (
    <button
      type="button"
      className={`logo-ai-concept${selected ? ' is-selected' : ''}${applied ? ' is-applied' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="logo-ai-concept-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} />
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
  );
}
