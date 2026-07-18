import React from 'react';

/**
 * Badge provider uniforme (Phase 14, REQ-AI-006).
 * Unica dicitura provider in tutta l'app: footer AI Console e pannelli AI.
 */
export default function AIProviderBadge(): React.ReactElement {
  return (
    <span className="ai-provider-badge" data-testid="ai-provider-badge">
      <span className="ai-provider-badge__dot" aria-hidden="true" />
      DeepSeek · Gemini
    </span>
  );
}
