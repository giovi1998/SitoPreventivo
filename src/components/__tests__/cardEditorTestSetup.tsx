import { vi } from 'vitest';
import { render } from '@testing-library/react';
import CardEditor from '../CardEditor';
import dataService from '../../utils/dataService';
import { createEmptyCard } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';
import {
  compressImage,
  generateCardPDF,
  generateCardPng,
  buildEmbeddedFontImport,
  resolveToBase64DataUrl,
} from '../../utils/cardGenerator';
import { useToast } from '../../hooks/useToast';

vi.mock('../../utils/dataService', () => ({
  default: {
    saveDocument: vi.fn().mockResolvedValue({ success: true }),
    getDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    deleteDocument: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    addToast: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAICard', () => ({
  useAICard: () => ({
    processCardPrompt: vi.fn().mockResolvedValue({
      card: createEmptyCard(),
      changes: ['Fronte: nome → "AI NAME"'],
      rawResponse: '{}',
    }),
    resetCardChat: vi.fn(),
    cardAiLogs: [],
    isCardProcessing: false,
    availableModels: [{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }],
  }),
}));

vi.mock('../../utils/cardGenerator', async () => {
  const actual = await vi.importActual<any>('../../utils/cardGenerator');
  return {
    ...actual,
    compressImage: vi.fn(async (file: File) => {
      if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
        throw new Error('Formato non supportato. Usa PNG, JPEG o SVG.');
      }
      if (file.size > 5_000_000) {
        throw new Error('File troppo grande (max 5MB)');
      }
      return 'data:image/jpeg;base64,COMPRESSED_' + file.name;
    }),
    generateCardPDF: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3])),
    generateCardPng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6])),
    buildEmbeddedFontImport: vi.fn(async () => ''),
    resolveToBase64DataUrl: vi.fn(async (url: string) => url),
  };
});

export const mockSave = dataService.saveDocument as unknown as ReturnType<typeof vi.fn>;
export const mockCompress = compressImage as unknown as ReturnType<typeof vi.fn>;
export const mockGenPDF = generateCardPDF as unknown as ReturnType<typeof vi.fn>;
export const mockGenPng = generateCardPng as unknown as ReturnType<typeof vi.fn>;
export const mockBuildEmbeddedFontImport = buildEmbeddedFontImport as unknown as ReturnType<typeof vi.fn>;
export const mockResolveToBase64DataUrl = resolveToBase64DataUrl as unknown as ReturnType<typeof vi.fn>;
export const { addToast: mockAddToast } = useToast();

export const baseProps = {
  userEmail: 'user@test.com',
  documentTheme: 'corporate' as const,
  tier: 'unlocked' as const,
};

export function renderEditor(overrides: Partial<typeof baseProps & { initialCard?: BusinessCard }> = {}) {
  return render(<CardEditor {...baseProps} {...overrides} />);
}