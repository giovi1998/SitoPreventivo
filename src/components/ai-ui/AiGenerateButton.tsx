import React from 'react';

export interface AiGenerateButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isProcessing: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function AiGenerateButton({
  isProcessing,
  loadingText = 'Elaborazione…',
  children,
  className = '',
  disabled,
  ...props
}: AiGenerateButtonProps) {
  return (
    <button
      type="button"
      className={`ai-generate-btn ${className}`}
      disabled={isProcessing || disabled}
      aria-busy={isProcessing}
      {...props}
    >
      {isProcessing ? loadingText : children}
    </button>
  );
}
