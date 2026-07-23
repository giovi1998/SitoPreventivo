import React, { useEffect, useRef } from 'react';

export interface AiPromptTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  label?: React.ReactNode;
}

/** Altezza massima (px) raggiunta in auto-grow; oltre ricompare lo scroll. */
const MAX_AUTO_HEIGHT = 320;

export function AiPromptTextarea({
  maxLength,
  label,
  value,
  className = '',
  ...props
}: AiPromptTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: la textarea cresce col contenuto fino a MAX_AUTO_HEIGHT.
  // Il CSS mantiene `resize: vertical` come fallback manuale: un resize
  // manuale vince finché `value` non cambia di nuovo (comportamento voluto).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_AUTO_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_AUTO_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <label className={`ai-prompt-wrapper ${className}`}>
      {label && (
        <div className="ai-prompt-header">
          <span className="ai-prompt-label">{label}</span>
          {maxLength !== undefined && (
            <span className="ai-prompt-counter">
              ({maxLength - currentLength} caratteri restanti)
            </span>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="ai-prompt-textarea"
        value={value}
        maxLength={maxLength}
        aria-label={label ? `${label}` : undefined}
        {...props}
      />
    </label>
  );
}
