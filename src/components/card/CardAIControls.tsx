import React from 'react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';
import { CARD_QUICK_ACTIONS } from '../../ai/prompts/cardQuickActions';

// Phase 2.2 refactor: pannello AI condiviso del bigliettino.

export interface CardAIModel {
  id: string;
  name: string;
  model: string;
}

export interface CardAIControlsProps {
  aiModel: string;
  onModelChange: (m: string) => void;
  aiText: string;
  onTextChange: (t: string) => void;
  availableModels: CardAIModel[];
  isProcessing: boolean;
  onRun: (mode: string) => void;
  onReset: () => void;
  logs: AILogEntry[];
  /** 'desktop' = colonna 3 (textarea 2 righe, apply primario). 'mobile' = tab/bottom-sheet (textarea 4 righe). */
  variant: 'desktop' | 'mobile';
  /** Spec v2.4: tier guard for cover image generation. */
  tier?: 'free' | 'unlocked';
  /** Spec v2.4: callback for "Genera cover AI" button. */
  onGenerateCover?: () => void;
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
  onGenerateCover,
}: CardAIControlsProps) {
  const isDesktop = variant === 'desktop';
  const coverLocked = tier !== 'unlocked';

  const modelSelect = (
    <select value={aiModel} onChange={(e) => onModelChange(e.target.value)} aria-label="Modello AI">
      {availableModels.length > 0 ? (
        availableModels.map((m) => (
          <option key={m.id} value={m.id}>{m.name}, {m.model}</option>
        ))
      ) : (
        <option value="deepseek-chat">DeepSeek Chat</option>
      )}
    </select>
  );

  const coverButton = onGenerateCover ? (
    <button
      type="button"
      className="card-ai-cover-btn"
      onClick={onGenerateCover}
      disabled={isProcessing || coverLocked}
      title={coverLocked ? 'Sblocca il piano per generare cover AI' : 'Genera uno sfondo AI per il fronte'}
    >
      {coverLocked ? '🔒 Cover AI (sblocca)' : '🎨 Genera cover AI'}
    </button>
  ) : null;

  const quickActions = (
    <div className="card-ai-actions">
      {CARD_QUICK_ACTIONS.map((a) => (
        <button
          key={a.mode}
          type="button"
          onClick={() => onRun(a.mode)}
          disabled={isProcessing}
          title={a.title}
        >
          {a.label}
        </button>
      ))}
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <div className="card-ai-model-row">
          <label className="card-field">
            <span>Modello AI</span>
            {modelSelect}
          </label>
        </div>
        {coverButton}
        <textarea
          className="card-ai-textarea"
          value={aiText}
          onChange={(e) => onTextChange(e.target.value)}
          aria-label="Prompt AI personalizzato"
          placeholder="Es. Rendi premium, cambia palette in navy, sposta il QR a sinistra..."
          rows={2}
        />
        {quickActions}
        <div className="card-ai-extra">
          <button type="button" className="card-action-primary" onClick={() => onRun('custom')} disabled={isProcessing}>
            {isProcessing ? 'Elaborazione...' : 'Applica prompt personalizzato'}
          </button>
          <button type="button" className="card-ai-reset" onClick={onReset} disabled={isProcessing}>
            Nuova conversazione
          </button>
        </div>
        <AILogPanel logs={logs} isProcessing={isProcessing} />
      </>
    );
  }

  // mobile (tab + bottom sheet)
  return (
    <>
      <label className="card-field">
        <span>Modello AI</span>
        {modelSelect}
      </label>
      {coverButton}
      <label className="card-field card-ai-textarea">
        <span>Prompt AI personalizzato</span>
        <textarea
          value={aiText}
          onChange={(e) => onTextChange(e.target.value)}
          rows={4}
          placeholder="Es. Rendi premium, cambia palette in navy, sposta il QR a sinistra..."
          aria-label="Prompt AI personalizzato"
        />
      </label>
      {quickActions}
      <button
        type="button"
        className="card-ai-apply"
        onClick={() => onRun('custom')}
        disabled={isProcessing || !aiText.trim()}
      >
        Applica prompt personalizzato
      </button>
      <button
        type="button"
        className="card-ai-reset"
        onClick={onReset}
        disabled={isProcessing}
      >
        Nuova conversazione
      </button>
      <AILogPanel logs={logs} isProcessing={isProcessing} />
    </>
  );
}
