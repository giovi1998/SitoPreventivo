import { describe, expect, it, vi } from 'vitest';
import {
  renderLogoScreenshot,
  compressPreviousBackground,
  buildLogoBackgroundPayload,
} from '../backgroundImage';
import type { Logo } from '../../documentSchemas';

const sampleLogo: Logo = {
  documentType: 'logo',
  id: 'test-logo-1',
  title: 'Test Logo',
  builder: {
    primaryText: 'Acme Corp',
    tagline: '',
    fontFamily: 'Inter',
    primaryColor: '#1e293b',
    secondaryColor: '#e2e8f0',
    iconType: 'lucide',
    iconGlyph: 'Sparkles',
    iconShape: 'rounded',
    layout: 'horizontal',
    textPosition: 'below',
    textColorMode: 'auto',
    textBackdrop: 'none',
    textOffsetX: 0,
    textOffsetY: 0,
    taglineOffsetX: 0,
    taglineOffsetY: 0,
    textScale: 1,
    gradientFill: false,
    decorativeElements: [],
    backgroundColor: '#ffffff',
    backgroundImage: null,
    imagePrompt: null,
    icons: [],
  },
  source: 'builder',
  brief: '',
  concepts: [],
  selected: -1,
  edits: { primaryText: '', primaryColor: '#01696F', secondaryColor: '#1a1a2e' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('backgroundImage logo helpers (TB-004)', () => {
  it('compressPreviousBackground returns undefined when logo has no backgroundImage', async () => {
    const res = await compressPreviousBackground(sampleLogo);
    expect(res).toBeUndefined();
  });

  it('buildLogoBackgroundPayload includes prompt, userEmail, imageModel, and image fields', () => {
    const payload = buildLogoBackgroundPayload(
      'A sleek tech background',
      {
        logoImage: 'data:image/jpeg;base64,mockLogo',
        previousBackground: 'data:image/jpeg;base64,mockPrevBg',
      },
      'admin@gmail.com',
      'gemini-3.1-flash-image'
    );

    expect(payload.prompt).toBe('A sleek tech background');
    expect(payload.userEmail).toBe('admin@gmail.com');
    expect(payload.imageModel).toBe('gemini-3.1-flash-image');
    expect(payload.logoImage).toBe('data:image/jpeg;base64,mockLogo');
    expect(payload.previousBackground).toBe('data:image/jpeg;base64,mockPrevBg');
  });

  it('buildLogoBackgroundPayload prunes previousBackground first if payload exceeds body budget', () => {
    const hugeImage = 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000);
    const payload = buildLogoBackgroundPayload(
      'Test prompt',
      {
        logoImage: 'data:image/jpeg;base64,smallLogo',
        previousBackground: hugeImage,
      },
      'test@example.com'
    );

    expect(payload.prompt).toBe('Test prompt');
    expect(payload.previousBackground).toBeUndefined();
    expect(payload.logoImage).toBe('data:image/jpeg;base64,smallLogo');
  });
});
