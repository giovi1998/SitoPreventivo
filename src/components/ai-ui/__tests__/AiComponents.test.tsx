import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSelect } from '../AiSelect';
import { AiGenerateButton } from '../AiGenerateButton';
import { AiActionChip, AiQuickActionCard, AiActionGrid } from '../AiActionChips';
import { AiTierGuard } from '../AiTierGuard';

describe('AiSelect', () => {
  it('renders correctly', () => {
    render(<AiSelect label="Modello" options={[{ value: '1', label: 'Uno' }]} />);
    expect(screen.getByText('Modello')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});

describe('AiGenerateButton', () => {
  it('shows loading text when processing', () => {
    render(<AiGenerateButton isProcessing={true} loadingText="Wait...">Run</AiGenerateButton>);
    expect(screen.getByText('Wait...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows children when not processing', () => {
    render(<AiGenerateButton isProcessing={false}>Run</AiGenerateButton>);
    expect(screen.getByText('Run')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

describe('AiActionChips', () => {
  it('renders chip', () => {
    render(<AiActionChip label="Chip1" />);
    expect(screen.getByText('Chip1')).toBeInTheDocument();
  });

  it('renders quick action card', () => {
    render(<AiQuickActionCard icon="X" label="Action1" description="Desc1" />);
    expect(screen.getByText('Action1')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Desc1');
  });

  it('renders grid with label', () => {
    render(<AiActionGrid groupLabel="Group1">Content</AiActionGrid>);
    expect(screen.getByText('Group1')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('AiTierGuard', () => {
  it('renders children if unlocked', () => {
    render(<AiTierGuard tier="unlocked" featureName="ProFeature">Content</AiTierGuard>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback if free', () => {
    render(<AiTierGuard tier="free" featureName="ProFeature">Content</AiTierGuard>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(screen.getByText('ProFeature')).toBeInTheDocument();
  });
});
