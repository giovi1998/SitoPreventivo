import React from 'react';
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
  className?: string;
}

/**
 * AIConsole pre-wired con AIHarness.
 * Usa `useAIHarness` per provider selection, costi, e preferenze AI.
 */
export default function AIHarnessConsole(props: AIHarnessConsoleProps): React.ReactElement {
  const harness = useAIHarness();
  return (
    <AIConsole
      {...props}
      lastCostUsd={harness.lastCostUsd}
      totalCostUsd={harness.totalCostUsd}
      onProviderChange={harness.setProvider}
      visionEnabled={harness.visionEnabled}
      providerId={harness.providerId}
      onVisionToggle={() => harness.setVision(!harness.visionEnabled)}
      autoFallbackEnabled={harness.autoFallbackEnabled}
      onAutoFallbackToggle={() => harness.setAutoFallback(!harness.autoFallbackEnabled)}
    />
  );
}
