import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiPromptTextarea } from '../AiPromptTextarea';

describe('AiPromptTextarea', () => {
  it('renders correctly', () => {
    render(<AiPromptTextarea label="Prompt" placeholder="Scrivi qui" />);
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Scrivi qui')).toBeInTheDocument();
  });

  it('shows character counter', () => {
    render(<AiPromptTextarea label="Prompt" value="Test" maxLength={100} onChange={() => {}} />);
    expect(screen.getByText('(96 caratteri restanti)')).toBeInTheDocument();
  });
});
