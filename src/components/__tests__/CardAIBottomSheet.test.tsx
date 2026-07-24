import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIBottomSheet from '../CardAIBottomSheet';

describe('CardAIBottomSheet', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when isOpen=true', () => {
    render(
      <CardAIBottomSheet isOpen onClose={() => {}}>
        <div data-testid="sheet-child">AI Panel Content</div>
      </CardAIBottomSheet>,
    );
    expect(screen.getByTestId('sheet-child')).toBeInTheDocument();
    expect(screen.getByText('AI Panel Content')).toBeInTheDocument();
  });

  it('does not render children when isOpen=false', () => {
    render(
      <CardAIBottomSheet isOpen={false} onClose={() => {}}>
        <div data-testid="sheet-child">AI Panel Content</div>
      </CardAIBottomSheet>,
    );
    expect(screen.queryByTestId('sheet-child')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <CardAIBottomSheet isOpen onClose={onClose}>
        <div>content</div>
      </CardAIBottomSheet>,
    );
    const backdrop = document.querySelector('.card-ai-bottom-sheet-backdrop') as HTMLElement;
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn();
    render(
      <CardAIBottomSheet isOpen onClose={onClose}>
        <div>content</div>
      </CardAIBottomSheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
