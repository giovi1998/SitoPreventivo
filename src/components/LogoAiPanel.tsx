import React, { useState, useEffect, useRef } from 'react';
import type { Logo, LogoBuilder, LogoSector } from '../utils/documentSchemas';
import { builderToSvg, sanitizeSvg } from '../utils/logoGenerator';
import { useAILogo } from '../hooks/useAILogo';
import { useToast } from '../hooks/useToast';
import AILogPanel from './AILogPanel';
import AIProviderBadge from './ai/AIProviderBadge';
import {
  AI_IMAGE_MODELS,
  getAiImageModelDefault,
  setAiImageModelDefault,
} from '../utils/uiPrefs';
import {
  AiTierGuard,
  AiPromptTextarea,
  AiSelect,
  AiGenerateButton,
  AiActionChip,
  AiActionGrid,
  AiPromptLibrary,
} from './ai-ui';
import {
  loadPromptLibrary as loadSharedPromptLibrary,
  addPromptEntry,
  removePromptEntry,
  PROMPT_LIBRARY_KEYS,
  type PromptLibraryEntry,
} from '../utils/promptLibrary';
import {
  type Step,
  type ChatAnswers,
  type LogoAiState,
  type PersistedState,
  LS_KEY,
  LS_TTL_MS,
  storageKeyFor,
  persistState,
} from '../utils/logo/logoAiPersistence';
import ConceptCard from './logo/ConceptCard';
import './LogoAiPanel.css';

export type { Step, ChatAnswers, LogoAiState };

interface Props {
  logo: Logo;
  onPatch: (patch: Partial<Logo['builder']>) => void;
  tier: 'free' | 'unlocked';
  userEmail?: string;
  docId?: string;
  initialState?: LogoAiState;
  onStateChange?: (state: LogoAiState) => void;
  onAiCall?: (kind: 'logoConcept' | 'background', costUsd: number) => void;
}

const SECTORS: LogoSector[] = ['tech', 'food', 'fashion', 'professionista'];
const MOODS = ['minimal', 'bold', 'playful', 'elegant', 'tech'] as const;

const SECTOR_LABELS: Record<LogoSector, string> = {
  tech: 'Tech',
  food: 'Food',
  fashion: 'Fashion',
  professionista: 'Professionista',
};

interface SectorVariant {
  label: string;
  activity: string;
  mood: (typeof MOODS)[number];
  target: string;
}

const SECTOR_PRESET_BRIEFS: Record<LogoSector, SectorVariant[]> = {
  tech: [
    {
      label: 'Startup SaaS',
      activity: 'Startup SaaS per la gestione di progetti in team remoti, con dashboard e integrazioni.',
      mood: 'tech',
      target: 'startup e team di sviluppo software',
    },
    {
      label: 'Agenzia web',
      activity: 'Agenzia web che realizza siti vetrina ed e-commerce per piccole imprese locali.',
      mood: 'bold',
      target: 'piccole imprese e artigiani',
    },
    {
      label: 'Studio di design',
      activity: 'Studio di design freelance specializzato in brand identity e packaging.',
      mood: 'elegant',
      target: 'startup e PMI creative',
    },
    {
      label: 'Consulente cloud',
      activity: 'Consulente cloud indipendente che aiuta aziende a migrare su AWS/GCP.',
      mood: 'minimal',
      target: 'CTO e responsabili IT',
    },
    {
      label: 'App mobile fitness',
      activity: 'App mobile per allenamenti domestici personalizzati con tracking e community.',
      mood: 'playful',
      target: 'giovani 18-35 fitness enthusiast',
    },
  ],
  food: [
    {
      label: 'Pizzeria napoletana',
      activity: 'Pizzeria napoletana artigianale nel centro città, forno a legna e ingredienti locali.',
      mood: 'bold',
      target: 'famiglie e giovani 20-40 anni',
    },
    {
      label: 'Ristorante cinese nuovo',
      activity: 'Ristorante cinese appena aperto, cucina del Sichuan autentica, ambiente moderno.',
      mood: 'bold',
      target: 'coppie e gruppi 25-45 curiosi',
    },
    {
      label: 'B&B biologico',
      activity: 'B&B biologico in campagna, colazione km zero e camere arredate in legno naturale.',
      mood: 'minimal',
      target: 'coppie e famiglie 30-55 che cercano relax',
    },
    {
      label: 'Gastropub artigianale',
      activity: 'Gastropub con birre artigianali e tapas, serate dal vivo e atmosfera informale.',
      mood: 'playful',
      target: 'giovani 25-40 e gruppi di amici',
    },
    {
      label: 'Gelateria gourmet',
      activity: 'Gelateria gourmet con gusti stagionali e sorbetti vegani, produzione propria.',
      mood: 'playful',
      target: 'famiglie e foodies di tutte le età',
    },
    {
      label: 'Enoteca wine bar',
      activity: 'Enoteca wine bar con selezione naturale e taglieri di salumi locali.',
      mood: 'elegant',
      target: 'adulti 30-60 amanti del vino',
    },
  ],
  fashion: [
    {
      label: 'Atelier sostenibile',
      activity: 'Atelier di moda sostenibile con capi su misura, tessuti naturali e produzione etica.',
      mood: 'elegant',
      target: 'donne 25-45 attente allo stile',
    },
    {
      label: 'Streetwear brand',
      activity: 'Marchio di streetwear indipendente con grafiche bold e drop a edizione limitata.',
      mood: 'bold',
      target: 'giovani 18-30 urban',
    },
    {
      label: 'Vintage & second hand',
      activity: 'Negozio di abbigliamento vintage selezionato, capi anni 70-90 restaurati.',
      mood: 'playful',
      target: 'giovani 20-35 e collezionisti',
    },
    {
      label: 'Pelletteria artigianale',
      activity: 'Pelletteria artigianale con borse e portafogli cuciti a mano in pelle italiana.',
      mood: 'elegant',
      target: 'adulti 35-60 alto spendente',
    },
    {
      label: 'Jewelry minimal',
      activity: 'Brand di gioielli minimal in argento, pezzi essenziali e geometrici.',
      mood: 'minimal',
      target: 'donne 25-45 design-conscious',
    },
  ],
  professionista: [
    {
      label: 'Studio legale lavoro',
      activity: 'Studio di consulenza legale specializzato in diritto del lavoro e contrattualistica.',
      mood: 'minimal',
      target: 'aziende e piccole-medie imprese',
    },
    {
      label: 'Studio medico generale',
      activity: 'Studio medico di medicina generale, prenotazioni online e telemedicina.',
      mood: 'minimal',
      target: 'famiglie e pazienti 30-70',
    },
    {
      label: 'Commercialista online',
      activity: 'Commercialista online per startup e freelance, consulenza fiscale via videochiamata.',
      mood: 'tech',
      target: 'liberi professionisti e startup 25-50',
    },
    {
      label: 'Architetto libero professionista',
      activity: 'Architetto libero professionista specializzato in ristrutturazioni residenziali.',
      mood: 'elegant',
      target: 'coppie e famiglie 30-60 che rinnovano casa',
    },
    {
      label: 'Fisioterapista sportivo',
      activity: 'Fisioterapista sportivo con riabilitazione post-infortunio e preparazione atletica.',
      mood: 'bold',
      target: 'sportivi 20-50 e squadre amatoriali',
    },
  ],
};

interface LogoConfig {
  enabled: boolean;
  provider: 'gemini' | 'replicate' | 'none';
}

function nowTime(): string {
  return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const DEFAULT_ANSWERS: ChatAnswers = { activity: '', mood: 'minimal', target: '', sector: 'tech' };

export default function LogoAiPanel({ logo, onPatch, tier, userEmail, docId, initialState, onStateChange, onAiCall }: Props) {
  const { generate, generateBackground, isProcessing, isGeneratingBg, logs, reset } = useAILogo(userEmail);
  const { addToast } = useToast();
  const lsKey = storageKeyFor(docId);

  const [step, setStep] = useState<Step>(initialState?.step ?? 'chat');
  const [answers, setAnswers] = useState<ChatAnswers>(initialState?.answers ?? DEFAULT_ANSWERS);
  const [concepts, setConcepts] = useState<LogoBuilder[]>(initialState?.concepts ?? []);
  const [selected, setSelected] = useState<number>(initialState?.selected ?? -1);
  const [bgImages, setBgImages] = useState<(string | null)[]>(initialState?.bgImages ?? [null, null, null]);
  const [bgErrors, setBgErrors] = useState<(string | null)[]>(initialState?.bgErrors ?? [null, null, null]);
  const [config, setConfig] = useState<LogoConfig | null>(null);
  const [library, setLibrary] = useState<PromptLibraryEntry[]>(() => loadSharedPromptLibrary(PROMPT_LIBRARY_KEYS.logo));
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [imageModel, setImageModel] = useState<string>(() => getAiImageModelDefault());

  const currentPreviewSvg = React.useMemo(() => {
    try {
      return sanitizeSvg(builderToSvg(logo.builder));
    } catch {
      return '';
    }
  }, [logo.builder]);

  useEffect(() => {
    if (initialState) return;
    try {
      const raw = localStorage.getItem(lsKey) ?? (docId ? localStorage.getItem(LS_KEY) : null);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed.ts && Date.now() - parsed.ts < LS_TTL_MS) {
          setAnswers(parsed.answers);
          setStep(parsed.step);
          if (parsed.concepts?.length) setConcepts(parsed.concepts);
          if (typeof parsed.selected === 'number') setSelected(parsed.selected);
          if (Array.isArray(parsed.bgImages)) setBgImages(parsed.bgImages);
        } else {
          localStorage.removeItem(lsKey);
        }
      }
    } catch {
      localStorage.removeItem(lsKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.({ answers, step, concepts, selected, bgImages, bgErrors });
  }, [answers, step, concepts, selected, bgImages, bgErrors, onStateChange]);

  const latestStateRef = useRef<PersistedState>({ answers, step, concepts, selected, bgImages, ts: 0 });
  useEffect(() => {
    latestStateRef.current = { answers, step, concepts, selected, bgImages, ts: Date.now() };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      persistState(lsKey, latestStateRef.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, step, concepts, selected, bgImages, lsKey]);

  useEffect(() => {
    return () => {
      persistState(lsKey, latestStateRef.current);
    };
  }, [lsKey]);

  useEffect(() => {
    fetch('/api/ai/logo-config')
      .then((r) => r.json())
      .then((c: LogoConfig) => {
        setConfig(c);
        if (c.provider === 'gemini') {
          console.log(`[Logo AI] Config attiva: ${c.provider} · ${nowTime()}`);
        }
      })
      .catch(() => setConfig({ enabled: false, provider: 'none' }));
  }, []);

  if (tier === 'free') {
    return (
      <AiTierGuard 
        tier="free" 
        featureName="AI Assist" 
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
      if (result.aiCall) onAiCall?.(result.aiCall.kind, result.aiCall.costUsd);
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
            return generateBackground({ ...logo, builder: concept }, ctxBase, { imageModel }).then((r) => ({ idx: i, r }));
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
    const patch: Partial<LogoBuilder> = { ...concept };
    delete (patch as Partial<LogoBuilder>).backgroundImage;
    if (bgImages[idx]) {
      patch.backgroundImage = bgImages[idx]!;
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
    localStorage.removeItem(lsKey);
  };

  const applyVariant = (variant: SectorVariant) => {
    setAnswers({ ...answers, activity: variant.activity, mood: variant.mood, target: variant.target });
  };

  const [variantOpen, setVariantOpen] = useState(false);
  const variantMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!variantOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (variantMenuRef.current && !variantMenuRef.current.contains(e.target as Node)) {
        setVariantOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVariantOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [variantOpen]);

  const applySectorExample = () => {
    const variants = SECTOR_PRESET_BRIEFS[answers.sector];
    if (variants && variants.length > 0) applyVariant(variants[0]);
  };

  const saveBriefToLibrary = () => {
    const label = window.prompt('Nome per questo brief (es. "Pizzeria Cagliari"):');
    if (!label || !label.trim()) return;
    setLibrary(addPromptEntry(PROMPT_LIBRARY_KEYS.logo, {
      label: label.trim(),
      activity: answers.activity,
      mood: answers.mood,
      target: answers.target,
      sector: answers.sector,
      module: 'logo',
    }));
    addToast('success', `Brief "${label.trim()}" salvato.`);
  };

  const applyBrief = (brief: PromptLibraryEntry) => {
    setAnswers({
      activity: brief.activity || '',
      mood: (brief.mood as ChatAnswers['mood']) || 'minimal',
      target: brief.target || '',
      sector: (brief.sector as LogoSector) || 'tech',
    });
  };

  const deleteBrief = (id: string) => {
    setLibrary(removePromptEntry(PROMPT_LIBRARY_KEYS.logo, id));
  };

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
      const r = await generateBackground({ ...logo, builder: concept }, ctx, { imageModel });
      if (r.aiCall) onAiCall?.(r.aiCall.kind, r.aiCall.costUsd);
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
    <section className="logo-ai-panel" aria-label="AI Assist">
      <h2>AI Assist</h2>
      {config?.provider === 'gemini' && (
        <div className="logo-ai-provider"><AIProviderBadge /></div>
      )}
      {config?.provider === 'gemini' && (
        <div className="logo-ai-image-model">
          <label htmlFor="logo-image-model">Modello immagine</label>
          <select
            id="logo-image-model"
            value={imageModel}
            onChange={(e) => {
              setImageModel(e.target.value);
              setAiImageModelDefault(e.target.value);
            }}
          >
            {AI_IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      <p className="logo-ai-hint">
        Rispondi a 3 domande. L'AI propone 3 concept di logo + background artistico. Il testo resta
        vettoriale (SVG editabile nel Builder).
      </p>

      <div
        className="logo-ai-current-preview"
        data-logo-preview="true"
        aria-label="Anteprima logo corrente"
        role="img"
        dangerouslySetInnerHTML={{ __html: currentPreviewSvg }}
      />

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
          <div className="logo-ai-variants" ref={variantMenuRef}>
            <button
              type="button"
              className="logo-ai-variants-btn"
              onClick={() => setVariantOpen((v) => !v)}
              aria-expanded={variantOpen}
              aria-haspopup="menu"
            >
              Altri esempi {SECTOR_LABELS[answers.sector]} ▾
            </button>
            {variantOpen && (
              <div className="logo-ai-variants-menu" role="menu">
                {SECTOR_PRESET_BRIEFS[answers.sector].map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    role="menuitem"
                    className="logo-ai-variants-item"
                    onClick={() => {
                      applyVariant(v);
                      setVariantOpen(false);
                    }}
                  >
                    <span className="logo-ai-variants-label">{v.label}</span>
                    <span className="logo-ai-variants-mood">mood: {v.mood}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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

          <AiPromptLibrary
            items={library}
            onSave={saveBriefToLibrary}
            onApply={applyBrief}
            onDelete={deleteBrief}
            saveDisabled={!canGenerate}
            title="I miei prompt"
            emptyHint="Nessun prompt salvato ancora. Compila il form e salvalo per riusarlo in futuro."
            className="logo-ai-library"
          />
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
