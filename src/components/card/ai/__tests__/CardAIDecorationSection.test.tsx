import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIDecorationSection from '../CardAIDecorationSection';
import { createEmptyCard } from '../../../../utils/documentSchemas';
import type { BusinessCard } from '../../../../utils/documentSchemas';

describe('CardAIDecorationSection', () => {
  const card: BusinessCard = {
    ...createEmptyCard(),
    decorations: {
      pattern: 'wave-bottom',
      opacity: 0.25,
      palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
      userLocked: false,
    },
  };

  function expandSection() {
    const header = screen.getByRole('button', { name: /decorazione/i });
    fireEvent.click(header);
  }

  it('renders thumbnail picker with none active when no pattern', () => {
    const empty = createEmptyCard();
    render(
      <CardAIDecorationSection
        card={empty}
        isProcessing={false}
        onPatchDecorations={vi.fn()}
      />,
    );
    expandSection();
    const noneBtn = screen.getByTestId('decoration-thumb-none');
    expect(noneBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('patches pattern when a thumbnail is clicked', () => {
    const onPatch = vi.fn();
    render(
      <CardAIDecorationSection
        card={card}
        isProcessing={false}
        onPatchDecorations={onPatch}
      />,
    );
    expandSection();
    fireEvent.click(screen.getByTestId('decoration-thumb-blob-corner'));
    expect(onPatch).toHaveBeenCalledWith({
      pattern: 'blob-corner',
      palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
    });
  });

  it('clears pattern when the none thumbnail is clicked', () => {
    const onPatch = vi.fn();
    render(
      <CardAIDecorationSection
        card={card}
        isProcessing={false}
        onPatchDecorations={onPatch}
      />,
    );
    expandSection();
    fireEvent.click(screen.getByTestId('decoration-thumb-none'));
    expect(onPatch).toHaveBeenCalledWith({
      pattern: null,
      palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff' },
    });
  });

  it('patches opacity via range', () => {
    const onPatch = vi.fn();
    render(
      <CardAIDecorationSection
        card={card}
        isProcessing={false}
        onPatchDecorations={onPatch}
      />,
    );
    expandSection();
    fireEvent.change(screen.getByLabelText(/opacità/i), { target: { value: '0.5' } });
    expect(onPatch).toHaveBeenCalledWith({ opacity: 0.5 });
  });

  it('patches palette colors', () => {
    const onPatch = vi.fn();
    render(
      <CardAIDecorationSection
        card={card}
        isProcessing={false}
        onPatchDecorations={onPatch}
      />,
    );
    expandSection();
    fireEvent.change(screen.getByLabelText(/colore primario/i), { target: { value: '#111111' } });
    fireEvent.change(screen.getByLabelText(/colore secondario/i), { target: { value: '#222222' } });
    fireEvent.change(screen.getByLabelText(/colore accento/i), { target: { value: '#333333' } });
    expect(onPatch).toHaveBeenCalledWith({ palette: { primary: '#111111', secondary: '#00ff00', accent: '#0000ff' } });
    expect(onPatch).toHaveBeenCalledWith({ palette: { primary: '#ff0000', secondary: '#222222', accent: '#0000ff' } });
    expect(onPatch).toHaveBeenCalledWith({ palette: { primary: '#ff0000', secondary: '#00ff00', accent: '#333333' } });
  });
});