import React, { useCallback } from 'react';
import { useAIHarness } from '../../utils/ai/aiModule';
import AIConsole from './AIConsole';
import type { AILogEntry } from '../../ai/types';

export type { AILogEntry };

export interface AIHarnessConsoleProps {
  title?: string;
  isProcessing: boolean;
  logs: AILogEntry[];
  tier: 'free' | 'unlocked';
  onSubmitPrompt: (text: string) => void;
  quickActions?: React.ReactNode;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  editorKind?: 'editor' | 'card' | 'flyer' | 'logo' | 'social';
  suggestedPrompt?: string;
  hidePrompt?: boolean;
  forceExpanded?: boolean;
  className?: string;
  /** TB-023: callback extra quando l'utente cambia provider dal badge. */
  onProviderChange?: (providerId: string) => void;
  /** Cancella i log AI (bottone ✕ nel pannello log). */
  onClearLogs?: () => void;
}

/**
 * AIConsole pre-wired con AIHarness.
 * Usa `useAIHarness` per provider selection, costi, e preferenze AI.
 */
export default function AIHarnessConsole({ onProviderChange, onClearLogs, ...props }: AIHarnessConsoleProps): React.ReactElement {
  const harness = useAIHarness();
  const handleProviderChange = useCallback(
    (providerId: string) => {
      harness.setProvider(providerId);
      onProviderChange?.(providerId);
    },
    [harness, onProviderChange]
  );
  return (
    <AIConsole
      {...props}
      lastCostUsd={harness.lastCostUsd}
      totalCostUsd={harness.totalCostUsd}
      onProviderChange={handleProviderChange}
      onClearLogs={onClearLogs}
      visionEnabled={harness.visionEnabled}
      providerId={harness.providerId}
      onVisionToggle={() => harness.setVision(!harness.visionEnabled)}
      autoFallbackEnabled={harness.autoFallbackEnabled}
      onAutoFallbackToggle={() => harness.setAutoFallback(!harness.autoFallbackEnabled)}
    />
  );
}
