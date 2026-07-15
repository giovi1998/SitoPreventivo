import React from 'react';

export interface AiPromptTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  label?: React.ReactNode;
}

export function AiPromptTextarea({
  maxLength,
  label,
  value,
  className = '',
  ...props
}: AiPromptTextareaProps) {
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
        className="ai-prompt-textarea"
        value={value}
        maxLength={maxLength}
        aria-label={label ? `${label}` : undefined}
        {...props}
      />
    </label>
  );
}
