import React from 'react';

interface CustomerResearchSectionProps {
  researchStatus: Record<string, string>;
  logoStatus: string;
}

export function CustomerResearchSection({
  researchStatus,
  logoStatus,
}: CustomerResearchSectionProps): React.ReactElement {
  return (
    <section className="crm-section" data-testid="crm-research-section">
      <h3>Research</h3>
      <div className="crm-timeline">
        <div className="crm-timeline-row">
          <span className="crm-timeline-label">Sito web</span>
          <span className={`crm-status-pill crm-status-${researchStatus.web === 'ok' ? 'ok' : 'warn'}`}>
            {researchStatus.web}
          </span>
        </div>
        <div className="crm-timeline-row">
          <span className="crm-timeline-label">Logo detection</span>
          <span
            className={`crm-status-pill crm-status-${logoStatus === 'ok' || logoStatus === 'manual' || logoStatus === 'detected' ? 'ok' : 'warn'}`}
            data-testid="crm-logo-status"
          >
            {logoStatus}
          </span>
        </div>
      </div>
    </section>
  );
}

export default CustomerResearchSection;
