import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIConsole from '../AIConsole';
import { getAiConsoleExpanded } from '../../../utils/uiPrefs';

const baseProps = {
  isProcessing: false,
  logs: [],
  tier: 'unlocked' as const,
  onSubmitPrompt: vi.fn(),
};

describe('AIConsole (REQ-AI-001/003/006)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renderizza header "AI Assist" e AIProviderBadge', () => {
    render(<AIConsole {...baseProps} />);
    expect(screen.getByText('AI Assist')).toBeInTheDocument();
    expect(screen.getByTestId('ai-provider-badge')).toHaveTextContent(/Ollama/);
  });

  it('persiste lo stato expanded in pq_ui:v1 quando editorKind è settato (REQ-AI-003)', () => {
    render(<AIConsole {...baseProps} editorKind="card" />);
    // default: espansa
    expect(screen.getByRole('button', { name: /Comprimi AI Assist/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Comprimi AI Assist/i }));
    expect(getAiConsoleExpanded('card')).toBe(false);
  });

  it('ripristina lo stato persisted da pq_ui:v1 ignorando defaultExpanded', () => {
    localStorage.setItem('pq_ui:v1', JSON.stringify({ version: 1, sidebarCollapsed: false, aiConsoleExpanded: { logo: false } }));
    render(<AIConsole {...baseProps} editorKind="logo" defaultExpanded={true} />);
    // persisted=false → collassata: il toggle offre "Espandi"
    expect(screen.getByRole('button', { name: /Espandi AI Assist/i })).toBeInTheDocument();
  });

  it('suggestedPrompt precompila la textarea (AI-first entry)', () => {
    render(<AIConsole {...baseProps} suggestedPrompt="Descrivi la tua attività, creo il bigliettino" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Descrivi la tua attività, creo il bigliettino');
  });

  it('hidePrompt nasconde la textarea (es. Social AI)', () => {
    render(<AIConsole {...baseProps} hidePrompt />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('submit chiama onSubmitPrompt con il testo e svuota la textarea', () => {
    const onSubmitPrompt = vi.fn();
    render(<AIConsole {...baseProps} onSubmitPrompt={onSubmitPrompt} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Crea un logo per pizzeria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Genera' }));
    expect(onSubmitPrompt).toHaveBeenCalledWith('Crea un logo per pizzeria');
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('mostra toggles vision e auto-fallback quando passati', () => {
    render(
      <AIConsole
        {...baseProps}
        providerId="ollama-minimax-m3"
        visionEnabled={true}
        onVisionToggle={vi.fn()}
        autoFallbackEnabled={true}
        onAutoFallbackToggle={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Vision ✓/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fallback automatico/i)).toBeChecked();
  });

  it('non mostra il bottone Analizza preview (design review rimossa)', () => {
    render(<AIConsole {...baseProps} />);
    expect(screen.queryByRole('button', { name: /Analizza preview con AI/i })).not.toBeInTheDocument();
  });

  it('renderizza quickActions una sola volta (regression: doppio render in console)', () => {
    render(
      <AIConsole
        {...baseProps}
        quickActions={<button type="button">Nuova sessione</button>}
      />
    );
    expect(screen.getAllByRole('button', { name: 'Nuova sessione' })).toHaveLength(1);
    expect(document.querySelectorAll('.ai-console__quick')).toHaveLength(1);
  });

  it('forceExpanded ignora la preferenza persistita collapsed (regression 2026-08-18: bottom sheet website vuota)', () => {
    // Bug: sheet mobile website renderizzava il toggle nascosto via CSS e
    // basta, perché pq_ui:v1 aveva website=false → pannello bianco.
    localStorage.setItem('pq_ui:v1', JSON.stringify({ version: 1, aiConsoleExpanded: { website: false } }));
    render(<AIConsole {...baseProps} editorKind="website" forceExpanded />);
    expect(screen.getByRole('button', { name: /Comprimi AI Assist/i })).toBeInTheDocument();
    expect(document.querySelector('.ai-console__panel')).not.toBeNull();
    // Lo stato persistito NON viene sovrascritto dal forceExpanded.
    expect(getAiConsoleExpanded('website')).toBe(false);
  });
});
