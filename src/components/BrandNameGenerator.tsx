import React, { useState } from 'react';
import { useAIOnboarding } from '../hooks/useAIOnboarding';
import { useToast } from '../hooks/useToast';

export interface BrandNameSuggestions {
  brandNameSuggestions: string[];
  displayName: string;
  companySuggestions: string[];
  professionSuggestions: string[];
  defaultColor: string;
}

interface Props {
  onApply: (result: BrandNameSuggestions) => void;
  userEmail?: string;
}

const MOODS = ['minimal', 'bold', 'playful', 'elegant', 'tech', 'luxury'] as const;

export default function BrandNameGenerator({ onApply, userEmail }: Props) {
  const { suggest, isProcessing, suggestions } = useAIOnboarding(userEmail);
  const { addToast } = useToast();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState<(typeof MOODS)[number]>('bold');
  const [keywords, setKeywords] = useState('');
  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [generationCount, setGenerationCount] = useState(0);

  const canGenerate = description.trim().length > 5;

  const handleGenerate = async () => {
    if (!canGenerate) {
      addToast('info', 'Descrivi la tua attività (almeno 6 caratteri).');
      return;
    }
    if (generationCount >= 2) {
      addToast('info', 'Massimo 2 generazioni. Reset chat per riprovare.');
      return;
    }
    try {
      // Componi input per l'orchestratore: usiamo la description come "name"
      // proxy e keywords come sector proxy (l'AI capisce dal contesto).
      const composed = `${description}. Mood: ${mood}. Keywords: ${keywords}`;
      const result = await suggest(composed, mood);
      if (result.applied && result.suggestions) {
        // L'orchestratore v1 ritorna companySuggestions/professionSuggestions.
        // Simuliamo brandNameSuggestions usando companySuggestions come
        // nomi brand (sono i nomi azienda plausibili).
        const names = result.suggestions.companySuggestions?.length
          ? result.suggestions.companySuggestions
          : ['Brand A', 'Brand B', 'Brand C', 'Brand D', 'Brand E'];
        setBrandNames(names.slice(0, 5));
        setStep('result');
        setGenerationCount((c) => c + 1);
        addToast('success', `${names.length} nomi generati. Scegline uno.`);
      } else {
        addToast('error', 'AI non ha generato nomi validi. Riprova.');
      }
    } catch (err) {
      addToast('error', 'Errore AI: ' + ((err as Error)?.message ?? 'unknown'));
    }
  };

  const handleChoose = (name: string) => {
    const others = brandNames.filter((n) => n !== name);
    onApply({
      brandNameSuggestions: [name, ...others],
      displayName: suggestions?.displayName ?? name,
      companySuggestions: suggestions?.companySuggestions ?? [name, `${name} Srl`, `${name} di Giovanni`],
      professionSuggestions: suggestions?.professionSuggestions ?? ['Professionista', 'Imprenditore', 'Consulente'],
      defaultColor: suggestions?.defaultColor ?? '#1A1A1A',
    });
    addToast('success', `"${name}" applicato. Modifica i campi negli step successivi.`);
  };

  if (step === 'result' && brandNames.length > 0) {
    return (
      <div className="brand-name-result">
        <p>Scegli un nome brand:</p>
        <ul className="brand-name-list">
          {brandNames.map((name) => (
            <li key={name}>
              <button type="button" onClick={() => handleChoose(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
        <div className="brand-name-actions">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isProcessing || generationCount >= 2}
          >
            {isProcessing ? 'Rigenerando…' : 'Rigenera'}
          </button>
          <button type="button" onClick={() => setStep('form')}>
            Indietro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-name-generator">
      <p className="bng-hint">Genera un nome brand con AI (stile namelix.com).</p>
      <label>
        <span className="bng-q">Descrivi la tua attività (1-2 frasi)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          rows={3}
          placeholder="Es. Pizzeria moderna a Cagliari, pizza napoletana"
        />
      </label>
      <div className="bng-mood">
        <span className="bng-q">Mood</span>
        <div className="bng-mood-options">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className={mood === m ? 'is-selected' : ''}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <label>
        <span className="bng-q">Parole chiave (opzionale, max 5, separate da virgola)</span>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value.slice(0, 200))}
          placeholder="pizza, cagliari, giovane"
        />
      </label>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isProcessing || !canGenerate || generationCount >= 2}
        className="bng-generate"
      >
        {isProcessing ? 'Sto pensando a nomi…' : 'Genera nomi brand'}
      </button>
    </div>
  );
}