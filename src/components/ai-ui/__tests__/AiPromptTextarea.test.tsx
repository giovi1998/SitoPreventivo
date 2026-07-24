import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiPromptTextarea } from '../AiPromptTextarea';

function mockScrollHeight(el: HTMLElement, height: number) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: height,
  });
}

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

  it('grows with multiline content up to scrollHeight', () => {
    const { rerender } = render(
      <AiPromptTextarea label="Prompt" value="breve" onChange={() => {}} />,
    );
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    mockScrollHeight(textarea, 200);
    const longText = Array.from({ length: 20 }, (_, i) => `Riga ${i}`).join('\n');
    rerender(<AiPromptTextarea label="Prompt" value={longText} onChange={() => {}} />);
    expect(textarea.style.height).toBe('200px');
    expect(textarea.style.overflowY).toBe('hidden');
  });

  it('caps height at 320px and restores overflow-y auto beyond the cap', () => {
    const { rerender } = render(
      <AiPromptTextarea label="Prompt" value="x" onChange={() => {}} />,
    );
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    mockScrollHeight(textarea, 1000);
    rerender(<AiPromptTextarea label="Prompt" value="xx" onChange={() => {}} />);
    expect(textarea.style.height).toBe('320px');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('shrinks to scrollHeight when content is short', () => {
    const { rerender } = render(
      <AiPromptTextarea label="Prompt" value="breve" onChange={() => {}} />,
    );
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    mockScrollHeight(textarea, 60);
    rerender(<AiPromptTextarea label="Prompt" value="breve!" onChange={() => {}} />);
    expect(textarea.style.height).toBe('60px');
    expect(textarea.style.overflowY).toBe('hidden');
  });

  it('recomputes height when value changes (controlled)', () => {
    const { rerender } = render(
      <AiPromptTextarea label="Prompt" value="a" onChange={() => {}} />,
    );
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    mockScrollHeight(textarea, 80);
    rerender(<AiPromptTextarea label="Prompt" value={'a\n'.repeat(30)} onChange={() => {}} />);
    expect(textarea.style.height).toBe('80px');

    mockScrollHeight(textarea, 55);
    rerender(<AiPromptTextarea label="Prompt" value="a" onChange={() => {}} />);
    expect(textarea.style.height).toBe('55px');
  });
});
