import React from 'react';
import type { PromptLibraryEntry } from '../../utils/promptLibrary';

export interface AiPromptLibraryProps {
  items: PromptLibraryEntry[];
  onSave: () => void;
  onApply: (entry: PromptLibraryEntry) => void;
  onDelete: (id: string) => void;
  saveDisabled?: boolean;
  title?: string;
  emptyHint?: string;
  className?: string;
}

export function AiPromptLibrary({
  items,
  onSave,
  onApply,
  onDelete,
  saveDisabled = false,
  title = 'I miei prompt',
  emptyHint = 'Nessun prompt salvato. Genera o scrivi un prompt e salvalo per riusarlo.',
  className = '',
}: AiPromptLibraryProps) {
  return (
    <div className={`ai-prompt-library ${className}`} data-testid="ai-prompt-library">
      <div className="ai-prompt-library-head">
        <span className="ai-prompt-library-title">{title}</span>
        <button
          type="button"
          className="ai-prompt-library-save"
          onClick={onSave}
          disabled={saveDisabled}
          title="Salva il prompt corrente nella libreria"
        >
          Salva prompt
        </button>
      </div>
      {items.length === 0 ? (
        <p className="ai-prompt-library-empty">{emptyHint}</p>
      ) : (
        <ul className="ai-prompt-library-list">
          {items.map((entry) => (
            <li key={entry.id} className="ai-prompt-library-item">
              <button
                type="button"
                className="ai-prompt-library-apply"
                onClick={() => onApply(entry)}
                title={entry.prompt || entry.activity || entry.label}
              >
                <span className="ai-prompt-library-label">{entry.label}</span>
                {(entry.prompt || entry.activity) && (
                  <span className="ai-prompt-library-preview">
                    {(entry.prompt || entry.activity || '').slice(0, 60)}
                    {(entry.prompt || entry.activity || '').length > 60 ? '…' : ''}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="ai-prompt-library-delete"
                onClick={() => onDelete(entry.id)}
                aria-label={`Elimina prompt ${entry.label}`}
                title="Elimina"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
