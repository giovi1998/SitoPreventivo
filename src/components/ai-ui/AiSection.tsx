import React, { useState } from 'react';

export interface AiSectionProps {
  title: string;
  id?: string;
  hint?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
  extra?: React.ReactNode;
  badge?: string | number;
  className?: string;
}

export function AiSection({
  title,
  id,
  hint,
  collapsible = false,
  defaultOpen = true,
  children,
  extra,
  badge,
  className = '',
}: AiSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (collapsible) {
      setOpen(!open);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(!open);
    }
  };

  const contentId = id ? `${id}-content` : undefined;

  const headerContent = (
    <div className="ai-section-header-content">
      <div className="ai-section-title-row">
        <h3 id={id} className="ai-section-title">
          {title}
        </h3>
        {badge !== undefined && <span className="ai-section-badge">{badge}</span>}
      </div>
      {hint && <p className="ai-section-hint">{hint}</p>}
    </div>
  );

  return (
    <section 
      className={`ai-section ${collapsible ? 'ai-section--collapsible' : ''} ${collapsible && open ? 'is-open' : ''} ${className}`}
      aria-labelledby={id}
    >
      <header
        className="ai-section-header"
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={handleKeyDown}
        aria-expanded={collapsible ? open : undefined}
        aria-controls={collapsible ? contentId : undefined}
      >
        {headerContent}
        
        <div className="ai-section-header-right">
          {extra && (
            <div onClick={(e) => { if (collapsible) e.stopPropagation(); }}>
              {extra}
            </div>
          )}
          {collapsible && (
            <svg 
              className="ai-section-chevron" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </header>
      
      {(!collapsible || open) && (
        <div id={contentId} className="ai-section-body">
          {children}
        </div>
      )}
    </section>
  );
}
