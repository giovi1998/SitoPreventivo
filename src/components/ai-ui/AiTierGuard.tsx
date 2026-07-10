import React from 'react';

export interface AiTierGuardProps {
  tier: 'free' | 'unlocked';
  featureName: string;
  fallbackMessage?: React.ReactNode;
  children: React.ReactNode;
}

export function AiTierGuard({ tier, featureName, fallbackMessage, children }: AiTierGuardProps) {
  if (tier === 'free') {
    return (
      <section className="ai-tier-guard-disabled" aria-label={`${featureName} riservata`}>
        <div className="ai-tier-guard-card" role="status">
          <h2>{featureName}</h2>
          <p>
            {fallbackMessage || `${featureName} è disponibile nel piano Pro o con codice sblocco. Riscatta un codice in Impostazioni.`}
          </p>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
