import { useState, type ReactNode } from 'react';

export interface CardEditorTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface CardEditorTabsProps {
  tabs: CardEditorTab[];
  defaultTab: string;
}

export default function CardEditorTabs({ tabs, defaultTab }: CardEditorTabsProps) {
  const [activeId, setActiveId] = useState(defaultTab);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="card-editor-tabs" data-testid="card-editor-tabs">
      <div className="card-editor-tabs-header" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === activeId}
            className={`card-editor-tab ${t.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(t.id)}
            data-testid={`tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card-editor-tabs-content" role="tabpanel" data-testid={`tab-content-${active.id}`}>
        {active.content}
      </div>
    </div>
  );
}
