import React from 'react';

export interface AiActionChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function AiActionChip({ label, className = '', ...props }: AiActionChipProps) {
  return (
    <button type="button" className={`ai-action-chip ${className}`} {...props}>
      {label}
    </button>
  );
}

export interface AiQuickActionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  description?: string;
}

export function AiQuickActionCard({ icon, label, description, className = '', ...props }: AiQuickActionCardProps) {
  return (
    <button 
      type="button" 
      className={`ai-quick-action-card ${className}`} 
      aria-label={description ? `${label}: ${description}` : label}
      title={description}
      {...props}
    >
      <span className="ai-quick-action-icon" aria-hidden="true">{icon}</span>
      <span className="ai-quick-action-label">{label}</span>
    </button>
  );
}

export interface AiActionGridProps {
  children: React.ReactNode;
  className?: string;
  groupLabel?: string;
}

export function AiActionGrid({ children, className = '', groupLabel }: AiActionGridProps) {
  return (
    <div className={`ai-action-grid ${className}`}>
      {groupLabel && <span className="ai-action-grid-label">{groupLabel}</span>}
      <div className="ai-action-grid-inner">
        {children}
      </div>
    </div>
  );
}
