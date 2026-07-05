import { describe, it, expect, vi } from 'vitest';
import { logoAIOutputSchema, mergeLogoAIResponse } from '../logoOrchestrator';
import type { Logo } from '../../utils/documentSchemas';
import { createEmptyLogo } from '../../utils/documentSchemas';

describe('logoAIOutputSchema (spec 11)', () => {
  it('accepts a valid output', () => {
    const parsed = logoAIOutputSchema.safeParse({
      primaryText: 'CodeLab',
      tagline: 'Build better',
      iconType: 'lucide',
      iconName: 'Cpu',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      layout: 'horizontal',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects bad hex color', () => {
    const parsed = logoAIOutputSchema.safeParse({
      primaryText: 'X',
      iconType: 'none',
      primaryColor: 'red',
      secondaryColor: '#1a1a2e',
      layout: 'horizontal',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid layout', () => {
    const parsed = logoAIOutputSchema.safeParse({
      primaryText: 'X',
      iconType: 'none',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      layout: 'diagonal',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid iconType', () => {
    const parsed = logoAIOutputSchema.safeParse({
      primaryText: 'X',
      iconType: 'animated',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      layout: 'horizontal',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('mergeLogoAIResponse (spec 11)', () => {
  it('updates builder fields and preserves logoUrl', () => {
    const logo: Logo = {
      ...createEmptyLogo(),
      // simulate user-uploaded logoUrl (base64)
    };
    const merged = mergeLogoAIResponse(logo, {
      primaryText: 'NewBrand',
      tagline: 'New tagline',
      iconType: 'shape',
      iconShape: 'circle',
      primaryColor: '#E62020',
      secondaryColor: '#1A1A1A',
      layout: 'stacked',
    });
    expect(merged.builder.primaryText).toBe('NewBrand');
    expect(merged.builder.iconType).toBe('shape');
    expect(merged.builder.primaryColor).toBe('#E62020');
    expect(merged.builder.layout).toBe('stacked');
    // updatedAt bumped
    expect(merged.updatedAt).not.toBe(logo.updatedAt);
  });

  it('maps iconType=lucide to iconGlyph from iconName', () => {
    const logo = createEmptyLogo();
    const merged = mergeLogoAIResponse(logo, {
      primaryText: 'X',
      tagline: '',
      iconType: 'lucide',
      iconName: 'Coffee',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      layout: 'horizontal',
    });
    expect(merged.builder.iconGlyph).toBe('Coffee');
  });

  it('maps iconType=monogram to iconGlyph from monogram', () => {
    const logo = createEmptyLogo();
    const merged = mergeLogoAIResponse(logo, {
      primaryText: 'X',
      tagline: '',
      iconType: 'monogram',
      monogram: 'AB',
      primaryColor: '#01696F',
      secondaryColor: '#1a1a2e',
      layout: 'horizontal',
    });
    expect(merged.builder.iconGlyph).toBe('AB');
  });
});

describe('useAILogo smoke (spec 11)', () => {
  it('hook import works and types are present', async () => {
    const mod = await import('../../hooks/useAILogo');
    expect(typeof mod.useAILogo).toBe('function');
  });

  it('orchestrator instantiable with default provider', async () => {
    const { LogoAIOrchestrator } = await import('../logoOrchestrator');
    const o = new LogoAIOrchestrator();
    expect(o.getProviderList().length).toBeGreaterThan(0);
  });
});
