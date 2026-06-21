import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('../../utils/quoteSchema', () => ({
  getTheme: () => ({ colors: { accent: '#000' } }),
}));

vi.mock('../DocumentPreview', () => ({
  default: () => <div data-testid="document-preview" />,
}));

vi.mock('../AILogPanel', () => ({
  default: () => <div data-testid="ai-log-panel" />,
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr) => arr),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

const baseQuote = {
  id: 'q1',
  title: 'Test',
  client: { name: 'Test', company: '', email: '', address: '', phone: '' },
  project: { description: '', scope: '', deliverables: [] },
  options: [],
  legalClauses: [],
  assumptions: [],
  pricing: { currency: 'EUR', taxRate: 22, discount: 0 },
  timeline: { startDate: '', endDate: '', milestones: [] },
  documentTemplate: 'corporate' as const,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const baseProps = {
  quote: baseQuote as any,
  aiText: '',
  setAiText: vi.fn(),
  patch: vi.fn(),
  updateOption: vi.fn(),
  addOption: vi.fn(),
  removeOption: vi.fn(),
  updateOptions: vi.fn(),
  updateClause: vi.fn(),
  addClause: vi.fn(),
  removeClause: vi.fn(),
  onRunAI: vi.fn(),
  aiModel: 'deepseek-chat',
  onAiModelChange: vi.fn(),
  previewRef: { current: null },
  aiLogs: [],
  isProcessing: false,
  availableModels: [{ id: 'm1', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }],
  onResetChat: vi.fn(),
  isDirty: false,
  saveQuote: vi.fn(),
  documentTheme: 'corporate' as const,
  onSave: vi.fn(),
  onExportPDF: vi.fn(),
  onExportDOCX: vi.fn(),
  onImportPDF: vi.fn(),
  onSaveAsTemplate: vi.fn(),
  lastSaveTime: null,
  pdfLoading: false,
  docxLoading: false,
};

describe('EditorView auto-save race condition fix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: does NOT fire auto-save while isProcessing=true (AC-001)', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    render(
      <EditorView {...baseProps} isDirty={true} isProcessing={true} saveQuote={saveQuote} />
    );
    vi.advanceTimersByTime(31000);
    expect(saveQuote).not.toHaveBeenCalled();
  });

  it('Test 2: does NOT fire auto-save within 5s after isProcessing goes false (AC-002)', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    const { rerender } = render(
      <EditorView {...baseProps} isDirty={true} isProcessing={true} saveQuote={saveQuote} />
    );
    // isProcessing goes false 3s before the 30s interval tick
    vi.advanceTimersByTime(27000);
    rerender(
      <EditorView {...baseProps} isDirty={true} isProcessing={false} saveQuote={saveQuote} />
    );
    // Advance to T=30s (interval fires, 3s after isProcessing went false)
    vi.advanceTimersByTime(3000);
    expect(saveQuote).not.toHaveBeenCalled();
  });

  it('Test 3: fires auto-save with silent:true 6s after isProcessing goes false (AC-003, AC-004)', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    const { rerender } = render(
      <EditorView {...baseProps} isDirty={true} isProcessing={true} saveQuote={saveQuote} />
    );
    // isProcessing goes false 6s before the 30s interval tick
    vi.advanceTimersByTime(24000);
    rerender(
      <EditorView {...baseProps} isDirty={true} isProcessing={false} saveQuote={saveQuote} />
    );
    // Advance to T=30s (interval fires, 6s after isProcessing went false, cooldown elapsed)
    vi.advanceTimersByTime(6000);
    expect(saveQuote).toHaveBeenCalledTimes(1);
    expect(saveQuote).toHaveBeenCalledWith({ silent: true });
  });

  it('does NOT fire auto-save when isDirty=false', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    render(
      <EditorView {...baseProps} isDirty={false} isProcessing={false} saveQuote={saveQuote} />
    );
    vi.advanceTimersByTime(31000);
    expect(saveQuote).not.toHaveBeenCalled();
  });

  it('Test 7: unmount clears the interval (no leak, AC-007)', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    const { unmount } = render(
      <EditorView {...baseProps} isDirty={true} isProcessing={false} saveQuote={saveQuote} />
    );
    vi.advanceTimersByTime(15000);
    unmount();
    // Advance past the 30s tick — if timer wasn't cleared, saveQuote would fire
    vi.advanceTimersByTime(20000);
    expect(saveQuote).not.toHaveBeenCalled();
  });

  it('rapid isProcessing true -> false -> true resets cooldown on second true->false (Edge case 8)', async () => {
    const EditorView = (await import('../EditorView')).default;
    const saveQuote = vi.fn();
    const { rerender } = render(
      <EditorView {...baseProps} isDirty={true} isProcessing={true} saveQuote={saveQuote} />
    );
    // First AI finishes at T=5s
    vi.advanceTimersByTime(5000);
    rerender(
      <EditorView {...baseProps} isDirty={true} isProcessing={false} saveQuote={saveQuote} />
    );
    // Second AI starts at T=6s (before cooldown expired)
    vi.advanceTimersByTime(1000);
    rerender(
      <EditorView {...baseProps} isDirty={true} isProcessing={true} saveQuote={saveQuote} />
    );
    // Second AI finishes at T=40s
    vi.advanceTimersByTime(34000);
    rerender(
      <EditorView {...baseProps} isDirty={true} isProcessing={false} saveQuote={saveQuote} />
    );
    // Cooldown is now T=40s + 5s = T=45s. Interval fires at T=60s.
    // At T=60s, cooldown (45s) expired → save fires with silent:true
    vi.advanceTimersByTime(20000);
    expect(saveQuote).toHaveBeenCalledWith({ silent: true });
  });
});
