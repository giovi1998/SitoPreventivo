// TB-027 B5: hook per generare 3 palette AI con preview SVG.
import { useCallback, useRef, useState } from 'react';
import { PaletteAIOrchestrator, type PaletteConcept, type PaletteProcessResult } from '../ai/PaletteOrchestrator';
import type { PaletteBrief } from '../ai/prompts/paletteSystem';

export interface UseAIPaletteReturn {
  generate: (brief: PaletteBrief, options?: { modelId?: string }) => Promise<PaletteProcessResult>;
  concepts: PaletteConcept[];
  isProcessing: boolean;
  error: string | null;
  reset: () => void;
}

export function useAIPalette(): UseAIPaletteReturn {
  const orchestratorRef = useRef<PaletteAIOrchestrator | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [concepts, setConcepts] = useState<PaletteConcept[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getOrchestrator = (): PaletteAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new PaletteAIOrchestrator();
    return orchestratorRef.current;
  };

  const generate = useCallback(async (brief: PaletteBrief, options?: { modelId?: string }): Promise<PaletteProcessResult> => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await getOrchestrator().generatePalettes(brief, { modelId: options?.modelId });
      setConcepts(result.concepts);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setConcepts([]);
    setError(null);
    getOrchestrator().resetSession();
  }, []);

  return { generate, concepts, isProcessing, error, reset };
}