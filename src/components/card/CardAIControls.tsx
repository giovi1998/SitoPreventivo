import React from 'react';
import AILogPanel from '../AILogPanel';
import AIProviderBadge from '../ai/AIProviderBadge';
import type { AILogEntry } from '../../ai/types';
import type { BusinessCard } from '../../utils/documentSchemas';
import {
  CardAICoverSection,
  CardAIPhotoSection,
  CardAIQuickActions,
  CardAIPromptSection,
  CardAIIconHeroSection,
} from './ai';
import type { PromptLibraryEntry } from '../../utils/promptLibrary';
import type { IconBackground } from '../../hooks/useAIIconHero';

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
  // Icon AI state
  iconPrompt?: string;
  setIconPrompt?: (v: string) => void;
  showIconPromptEditor?: boolean;
  setShowIconPromptEditor?: (v: boolean) => void;
  onGenerateIcon?: (opts: { imageModel: string; background: IconBackground }) => void;
  onFillAutoIconPrompt?: () => void;
  iconLibrary?: PromptLibraryEntry[];
  onSaveIconPrompt?: () => void;
  onApplyIconPrompt?: (entry: PromptLibraryEntry) => void;
  onDeleteIconPrompt?: (id: string) => void;
  iconHeroLogs?: AILogEntry[];
  // Cover AI state
  coverPrompt?: string;
  setCoverPrompt?: (v: string) => void;
  showCoverPromptEditor?: boolean;
  setShowCoverPromptEditor?: (v: boolean) => void;
  coverLibrary?: PromptLibraryEntry[];
  onSaveCoverPrompt?: () => void;
  onApplyCoverPrompt?: (entry: PromptLibraryEntry) => void;
  onDeleteCoverPrompt?: (id: string) => void;
  onFillAutoCoverPrompt?: () => void;
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
  onModelChange,
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
  iconPrompt = '',
  setIconPrompt,
  showIconPromptEditor = false,
  setShowIconPromptEditor,
  onGenerateIcon,
  onFillAutoIconPrompt,
  iconLibrary = [],
  onSaveIconPrompt,
  onApplyIconPrompt,
  onDeleteIconPrompt,
  iconHeroLogs,
  coverPrompt = '',
  setCoverPrompt,
  showCoverPromptEditor = false,
  setShowCoverPromptEditor,
  coverLibrary = [],
  onSaveCoverPrompt,
  onApplyCoverPrompt,
  onDeleteCoverPrompt,
  onFillAutoCoverPrompt,
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
  return (
    <div className="card-ai-panel" data-testid="card-ai-panel">
      {/* Mobile: il bottom sheet non ha la AIConsole header, quindi il badge
       * provider va dentro il pannello. Su desktop è la console a mostrarlo. */}
      {variant === 'mobile' && (
        <div className="card-ai-mobile-provider">
          <AIProviderBadge onProviderChange={(id) => onModelChange?.(id)} />
        </div>
      )}

      {/* ─── Immagini AI: foto, icona, sfondo (in quest'ordine) ─── */}
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

      {card && onGenerateIcon && setIconPrompt && setShowIconPromptEditor && onFillAutoIconPrompt && onSaveIconPrompt && onApplyIconPrompt && onDeleteIconPrompt && (
        <CardAIIconHeroSection
          card={card}
          tier={tier}
          isProcessing={isProcessing}
          iconPrompt={iconPrompt}
          onIconPromptChange={setIconPrompt}
          showPromptEditor={showIconPromptEditor}
          onTogglePromptEditor={() => setShowIconPromptEditor(!showIconPromptEditor)}
          onGenerateIcon={onGenerateIcon}
          onFillAutoPrompt={onFillAutoIconPrompt}
          library={iconLibrary}
          onSavePrompt={onSaveIconPrompt}
          onApplyPrompt={onApplyIconPrompt}
          onDeletePrompt={onDeleteIconPrompt}
        />
      )}

      {card && onGenerateCover && setCoverPrompt && setShowCoverPromptEditor && onSaveCoverPrompt && onApplyCoverPrompt && onDeleteCoverPrompt && onFillAutoCoverPrompt && (
        <CardAICoverSection
          card={card}
          tier={tier}
          isProcessing={isProcessing}
          onGenerate={onGenerateCover}
          onRemove={onRemoveCover}
          coverPrompt={coverPrompt}
          onCoverPromptChange={setCoverPrompt}
          showPromptEditor={showCoverPromptEditor}
          onTogglePromptEditor={() => setShowCoverPromptEditor(!showCoverPromptEditor)}
          library={coverLibrary}
          onSavePrompt={onSaveCoverPrompt}
          onApplyPrompt={onApplyCoverPrompt}
          onDeletePrompt={onDeleteCoverPrompt}
          onFillAutoPrompt={onFillAutoCoverPrompt}
        />
      )}

      {/* ─── Testo AI: azioni rapide + prompt libero ─── */}
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

      {!bare && <AILogPanel logs={logs} isProcessing={isProcessing} />}
    </div>
  );
}
