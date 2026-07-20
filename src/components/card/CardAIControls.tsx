import React from 'react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';
import type { BusinessCard } from '../../utils/documentSchemas';
import {
  CardAICoverSection,
  CardAIPhotoSection,
  CardAIQuickActions,
  CardAIPromptSection,
  CardAIDecorationSection,
  CardAIIconHeroSection,
} from './ai';
import type { PromptLibraryEntry } from '../../utils/promptLibrary';

export interface CardAIModel {
  id: string;
  name: string;
  model: string;
}

export interface CardAIControlsProps {
  /** Active model ID (read-only; selection happens in AIProviderBadge). */
  aiModel: string;
  /** Kept for API compatibility; no-op in bare panel. */
  onModelChange?: (m: string) => void;
  aiText: string;
  onTextChange: (t: string) => void;
  availableModels: CardAIModel[];
  isProcessing: boolean;
  onRun: (mode: string) => void;
  onReset: () => void;
  logs: AILogEntry[];
  variant: 'desktop' | 'mobile';
  tier?: 'free' | 'unlocked';
  /**
   * Phase 14 (REQ-AI-002): dentro la AIConsole rail l'AILogPanel è fornito
   * dalla console — `bare` lo nasconde per evitare duplicati.
   */
  bare?: boolean;
  onGenerateCover?: (side: 'front' | 'back' | 'both', imageModel?: string) => void;
  onRemoveCover?: (side: 'front' | 'back') => void;
  onGeneratePhoto?: (imageModel?: string) => void;
  card?: BusinessCard;
  onPatchDecorations?: (patch: Partial<BusinessCard['decorations']>) => void;
  // Icon AI state
  iconPrompt?: string;
  setIconPrompt?: (v: string) => void;
  onGenerateIcon?: () => void;
  iconHeroLogs?: AILogEntry[];
  // Photo prompt library state
  photoPrompt?: string;
  setPhotoPrompt?: (v: string) => void;
  showPhotoPromptEditor?: boolean;
  setShowPhotoPromptEditor?: (v: boolean) => void;
  photoLibrary?: PromptLibraryEntry[];
  onSavePhotoPrompt?: () => void;
  onApplyPhotoPrompt?: (entry: PromptLibraryEntry) => void;
  onDeletePhotoPrompt?: (id: string) => void;
  onFillAutoPhotoPrompt?: () => void;
}

export default function CardAIControls({
  aiModel,
  aiText,
  onTextChange,
  availableModels,
  isProcessing,
  onRun,
  onReset,
  logs,
  variant,
  tier = 'free',
  bare = false,
  onGenerateCover,
  onRemoveCover,
  onGeneratePhoto,
  card,
  onPatchDecorations,
  iconPrompt = '',
  setIconPrompt,
  onGenerateIcon,
  iconHeroLogs,
  photoPrompt = '',
  setPhotoPrompt,
  showPhotoPromptEditor = false,
  setShowPhotoPromptEditor,
  photoLibrary = [],
  onSavePhotoPrompt,
  onApplyPhotoPrompt,
  onDeletePhotoPrompt,
  onFillAutoPhotoPrompt,
}: CardAIControlsProps) {
  const activeProviderLabel = availableModels.find((o) => o.id === aiModel)?.name ?? aiModel;

  return (
    <div className="card-ai-panel" data-testid="card-ai-panel">
      <div className="card-ai-model-readout" aria-label="Modello AI attivo">
        <span className="card-ai-model-readout__label">Modello</span>
        <span className="card-ai-model-readout__value">{activeProviderLabel}</span>
      </div>

      {card && onGeneratePhoto && setPhotoPrompt && setShowPhotoPromptEditor && onSavePhotoPrompt && onApplyPhotoPrompt && onDeletePhotoPrompt && onFillAutoPhotoPrompt && (
        <CardAIPhotoSection
          card={card}
          tier={tier}
          isProcessing={isProcessing}
          prompt={photoPrompt}
          onPromptChange={setPhotoPrompt}
          showPromptEditor={showPhotoPromptEditor}
          onTogglePromptEditor={() => setShowPhotoPromptEditor(!showPhotoPromptEditor)}
          onGenerate={onGeneratePhoto}
          library={photoLibrary}
          onSavePrompt={onSavePhotoPrompt}
          onApplyPrompt={onApplyPhotoPrompt}
          onDeletePrompt={onDeletePhotoPrompt}
          onFillAutoPrompt={onFillAutoPhotoPrompt}
        />
      )}

      {card && onGenerateCover && (
        <CardAICoverSection
          card={card}
          tier={tier}
          isProcessing={isProcessing}
          onGenerate={onGenerateCover}
          onRemove={onRemoveCover}
        />
      )}

      <CardAIQuickActions isProcessing={isProcessing} onRun={onRun} />

      <CardAIPromptSection
        aiText={aiText}
        onTextChange={onTextChange}
        isProcessing={isProcessing}
        tier={tier}
        onRun={() => onRun('custom')}
        onReset={onReset}
        variant={variant}
      />

      {card && onGenerateIcon && setIconPrompt && (
        <CardAIIconHeroSection
          card={card}
          tier={tier}
          isProcessing={isProcessing}
          iconPrompt={iconPrompt}
          onIconPromptChange={setIconPrompt}
          onGenerateIcon={onGenerateIcon}
        />
      )}

      {card && onPatchDecorations && (
        <CardAIDecorationSection
          card={card}
          isProcessing={isProcessing}
          onPatchDecorations={onPatchDecorations}
        />
      )}

      {!bare && <AILogPanel logs={logs} isProcessing={isProcessing} />}
    </div>
  );
}
