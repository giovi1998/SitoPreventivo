import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      interactions = { create: createMock };
    },
  };
});

// Imported after the mock so the mocked module is used.
const { GeminiImageProvider, resolveImageSize } = await import('../gemini');

describe('GeminiImageProvider (spec v2.1, @google/genai SDK)', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('returns base64 image on success', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'iVBORw0KGgoAAAANSUhEUg==', mime_type: 'image/png' },
    });
    const provider = new GeminiImageProvider('fake-key');
    const result = await provider.generateBackground('Artistic background');
    expect(result.imageBase64).toBe('iVBORw0KGgoAAAANSUhEUg==');
    expect(result.mimeType).toBe('image/png');
  });

  it('defaults mimeType to image/png when missing', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'iVBORw0KGgoAAAANSUhEUg==' },
    });
    const provider = new GeminiImageProvider('fake-key');
    const result = await provider.generateBackground('Artistic background');
    expect(result.mimeType).toBe('image/png');
  });

  it('throws GEMINI_INVALID_KEY on 401/UNAUTHENTICATED errors', async () => {
    createMock.mockRejectedValueOnce(new Error('401 UNAUTHENTICATED: invalid key'));
    const provider = new GeminiImageProvider('bad-key');
    await expect(provider.generateBackground('test')).rejects.toThrow('GEMINI_INVALID_KEY');
  });

  it('throws GEMINI_QUOTA_EXCEEDED on 429/RESOURCE_EXHAUSTED errors', async () => {
    createMock.mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED: quota exceeded'));
    const provider = new GeminiImageProvider('over-key');
    await expect(provider.generateBackground('test')).rejects.toThrow('GEMINI_QUOTA_EXCEEDED');
  });

  it('throws GEMINI_NO_IMAGE_IN_RESPONSE when output_image missing', async () => {
    createMock.mockResolvedValueOnce({});
    const provider = new GeminiImageProvider('ok-key');
    await expect(provider.generateBackground('test')).rejects.toThrow('GEMINI_NO_IMAGE_IN_RESPONSE');
  });

  it('throws GEMINI_NO_IMAGE_IN_RESPONSE when output_image.data missing', async () => {
    createMock.mockResolvedValueOnce({ output_image: {} });
    const provider = new GeminiImageProvider('ok-key');
    await expect(provider.generateBackground('test')).rejects.toThrow('GEMINI_NO_IMAGE_IN_RESPONSE');
  });

  it('rethrows unrecognized errors as-is', async () => {
    createMock.mockRejectedValueOnce(new Error('Something else broke'));
    const provider = new GeminiImageProvider('ok-key');
    await expect(provider.generateBackground('test')).rejects.toThrow('Something else broke');
  });

  it('passes model, prompt, timeout and a 1K imageConfig to interactions.create', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'abc', mime_type: 'image/jpeg' },
    });
    const provider = new GeminiImageProvider('fake-key', 'gemini-3.1-flash-image');
    await provider.generateBackground('A prompt', 15_000);
    // Niente image_output_options: le interactions API lo rifiutano (400
    // Unknown parameter, probe live 2026-08-07); JPEG è già l'output default.
    expect(createMock).toHaveBeenCalledWith(
      {
        model: 'gemini-3.1-flash-image',
        input: 'A prompt',
        generation_config: {
          image_config: { image_size: '1K', aspect_ratio: '16:9' },
        },
        response_modalities: ['text', 'image'],
      },
      { timeout: 15_000 },
    );
  });

  it('generateCardCover requests 1K without output options', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'abc', mime_type: 'image/jpeg' },
    });
    const provider = new GeminiImageProvider('fake-key');
    await provider.generateCardCover('Cover prompt');
    expect(createMock.mock.calls[0][0].generation_config.image_config).toEqual({
      image_size: '1K',
      aspect_ratio: '1:1',
    });
  });

  it('forces image_size 1K for Nano Banana 2 Lite even when 2K is requested', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'abc', mime_type: 'image/jpeg' },
    });
    const provider = new GeminiImageProvider('fake-key', 'gemini-3.1-flash-lite-image');
    await provider.generateBackground('A prompt');
    expect(createMock.mock.calls[0][0].model).toBe('gemini-3.1-flash-lite-image');
    expect(createMock.mock.calls[0][0].generation_config.image_config.image_size).toBe('1K');
  });
});

describe('resolveImageSize', () => {
  it('forces 1K for gemini-3.1-flash-lite-image', () => {
    expect(resolveImageSize('gemini-3.1-flash-lite-image', '2K')).toBe('1K');
    expect(resolveImageSize('gemini-3.1-flash-lite-image', '512')).toBe('1K');
  });

  it('delegates the requested size for other models', () => {
    expect(resolveImageSize('gemini-3.1-flash-image', '2K')).toBe('2K');
    expect(resolveImageSize('gemini-3.1-flash-image', '1K')).toBe('1K');
  });
});
