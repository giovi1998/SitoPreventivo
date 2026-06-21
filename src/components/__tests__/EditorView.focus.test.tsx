import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

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

describe('EditorView focus mode rendering', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows focus button in tab bar and hides preview-toolbar focus when previewFocus is false', async () => {
    const EditorView = (await import('../EditorView')).default;
    render(<EditorView {...baseProps} />);
    const mobileFocus = screen.queryAllByTestId('focus-toggle-mobile');
    const previewFocus = screen.queryAllByTestId('focus-toggle');
    expect(mobileFocus.length).toBe(1);
    expect(previewFocus.length).toBe(0);
  });

  it('moves focus button from tab bar to preview toolbar when activated', async () => {
    const EditorView = (await import('../EditorView')).default;
    render(<EditorView {...baseProps} />);
    expect(screen.queryAllByTestId('focus-toggle-mobile').length).toBe(1);
    expect(screen.queryAllByTestId('focus-toggle').length).toBe(0);
    fireEvent.click(screen.getByTestId('focus-toggle-mobile'));
    expect(screen.queryAllByTestId('focus-toggle-mobile').length).toBe(0);
    expect(screen.queryAllByTestId('focus-toggle').length).toBe(1);
  });

  it('returns focus button to tab bar when preview-toolbar focus is clicked (exit)', async () => {
    const EditorView = (await import('../EditorView')).default;
    render(<EditorView {...baseProps} />);
    fireEvent.click(screen.getByTestId('focus-toggle-mobile'));
    await waitFor(() => expect(screen.queryAllByTestId('focus-toggle').length).toBe(1));
    fireEvent.click(screen.getByTestId('focus-toggle'));
    await waitFor(() => expect(screen.queryAllByTestId('focus-toggle').length).toBe(0));
    await waitFor(() => expect(screen.queryAllByTestId('focus-toggle-mobile').length).toBe(1));
  });
});

describe('EditorView focus toggle source code regression', () => {
  it('does not render focusModeToggle inside editor-mobile-actions-buttons (regression test for triple focus button bug)', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'EditorView.tsx'),
      'utf-8'
    );
    const actionsBlock = file.match(/editor-mobile-actions-buttons[\s\S]*?<\/div>/);
    expect(actionsBlock).not.toBeNull();
    expect(actionsBlock![0]).not.toContain('focusModeToggle');
  });

  it('conditionally renders focusModeToggle in preview toolbar (only when active)', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'EditorView.tsx'),
      'utf-8'
    );
    const previewToolbar = file.match(/<div className="preview-toolbar">[\s\S]*?<\/div>/);
    expect(previewToolbar).not.toBeNull();
    expect(previewToolbar![0]).toMatch(/\{previewFocus\s*&&\s*focusModeToggle\}/);
  });

  it('renders focus-toggle-mobile in mobile bar', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'EditorView.tsx'),
      'utf-8'
    );
    const mobileBar = file.match(/<div className="editor-mobile-bar">[\s\S]*?<\/div>\s*\{mobileTab/);
    expect(mobileBar).not.toBeNull();
    expect(mobileBar![0]).toContain('focus-toggle-mobile');
  });
});
