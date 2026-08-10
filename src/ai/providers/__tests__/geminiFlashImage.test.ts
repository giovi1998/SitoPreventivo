import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      interactions = { create: createMock };
    },
  };
});

const { GeminiFlashImageProvider, GEMINI_FLASH_MODEL } = await import('../geminiFlashImage');

describe('GeminiFlashImageProvider (TB-023)', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('uses gemini-2.0-flash-preview-image-generation model', () => {
    const p = new GeminiFlashImageProvider('fake-key');
    // Il modello è privato nel parent, verifichiamo indirettamente via
    // la chiamata a interactions.create
    createMock.mockResolvedValueOnce({
      output_image: { data: 'abc', mime_type: 'image/png' },
    });
    return p.generateIcon('apple', { primaryColor: '#E62020', secondaryColor: '#1A1A1A' }).then(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: GEMINI_FLASH_MODEL }),
        expect.anything(),
      );
    });
  });

  it('generateIcon builds flat 2-color prompt with transparent bg', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'iconB64', mime_type: 'image/png' },
    });
    const p = new GeminiFlashImageProvider('fake-key');
    const result = await p.generateIcon('mela', {
      primaryColor: '#E62020',
      secondaryColor: '#1A1A1A',
      style: 'hand-drawn',
    });
    expect(result.imageBase64).toBe('iconB64');
    const call = createMock.mock.calls[0][0];
    const input = call.input as string;
    expect(input).toMatch(/mela/);
    expect(input).toMatch(/#E62020/);
    expect(input).toMatch(/#1A1A1A/);
    expect(input).toMatch(/hand-drawn/);
    expect(input).toMatch(/Transparent background/);
    expect(input).toMatch(/No text/);
    expect(call.generation_config.image_config.image_size).toBe('1K');
    expect(call.generation_config.image_config.aspect_ratio).toBe('1:1');
  });

  it('generateIcon defaults style to minimalist', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'x', mime_type: 'image/png' },
    });
    const p = new GeminiFlashImageProvider('fake-key');
    await p.generateIcon('sun', { primaryColor: '#fff', secondaryColor: '#000' });
    const input = (createMock.mock.calls[0][0].input as string);
    expect(input).toMatch(/minimalist/);
  });

  it('generateHeroIllustration uses 16:9 aspect ratio', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: 'hero', mime_type: 'image/png' },
    });
    const p = new GeminiFlashImageProvider('fake-key');
    await p.generateHeroIllustration('pizza napoletana', {
      primaryColor: '#E62020',
      secondaryColor: '#1A1A1A',
    });
    const call = createMock.mock.calls[0][0];
    expect(call.generation_config.image_config.aspect_ratio).toBe('16:9');
    expect((call.input as string)).toMatch(/pizza napoletana/);
    expect((call.input as string)).toMatch(/hero illustration/);
  });

  it('inherits error handling from GeminiImageProvider (401 → GEMINI_INVALID_KEY)', async () => {
    createMock.mockRejectedValueOnce(new Error('401 UNAUTHENTICATED'));
    const p = new GeminiFlashImageProvider('bad-key');
    await expect(
      p.generateIcon('test', { primaryColor: '#fff', secondaryColor: '#000' }),
    ).rejects.toThrow('GEMINI_INVALID_KEY');
  });

  it('inherits 429 → GEMINI_QUOTA_EXCEEDED', async () => {
    createMock.mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED'));
    const p = new GeminiFlashImageProvider('over-key');
    await expect(
      p.generateIcon('test', { primaryColor: '#fff', secondaryColor: '#000' }),
    ).rejects.toThrow('GEMINI_QUOTA_EXCEEDED');
  });
});