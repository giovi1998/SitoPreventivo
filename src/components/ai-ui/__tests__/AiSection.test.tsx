import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSection } from '../AiSection';

describe('AiSection', () => {
  it('renders correctly', () => {
    render(<AiSection title="Test Section">Content</AiSection>);
    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders hint and badge', () => {
    render(
      <AiSection title="Test" hint="Hint text" badge="New">
        Content
      </AiSection>
    );
    expect(screen.getByText('Hint text')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('toggles when collapsible is true', () => {
    render(
      <AiSection title="Collapsible" collapsible={true} defaultOpen={false}>
        Content
      </AiSection>
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();

    const header = screen.getByRole('button');
    fireEvent.click(header);

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
