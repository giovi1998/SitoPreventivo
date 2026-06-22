import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardEditorTabs from '../CardEditorTabs';

const tabs = [
  { id: 'preview', label: 'Anteprima', content: <div data-testid="content-preview">Preview here</div> },
  { id: 'edit', label: 'Modifica', content: <div data-testid="content-edit">Form here</div> },
  { id: 'ai', label: 'AI', content: <div data-testid="content-ai">AI here</div> },
];

describe('CardEditorTabs', () => {
  it('renders all tab buttons and shows default tab content', () => {
    render(<CardEditorTabs tabs={tabs} defaultTab="preview" />);
    expect(screen.getByRole('tab', { name: /Anteprima/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Modifica/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /AI/i })).toBeInTheDocument();
    expect(screen.getByTestId('content-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('content-edit')).not.toBeInTheDocument();
  });

  it('switches content when a different tab is clicked', () => {
    render(<CardEditorTabs tabs={tabs} defaultTab="preview" />);
    fireEvent.click(screen.getByRole('tab', { name: /Modifica/i }));
    expect(screen.getByTestId('content-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('content-preview')).not.toBeInTheDocument();
  });
});
