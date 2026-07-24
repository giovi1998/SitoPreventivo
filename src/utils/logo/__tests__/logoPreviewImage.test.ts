import { describe, it, expect } from 'vitest';
import { renderLogoPreviewImage } from '../logoPreviewImage';
import { createEmptyLogo } from '../../documentSchemas';

describe('renderLogoPreviewImage', () => {
  it('returns null in jsdom (canvas not available)', async () => {
    const logo = createEmptyLogo();
    logo.builder.primaryText = 'Test';
    logo.builder.iconType = 'shape';
    const result = await renderLogoPreviewImage(logo);
    expect(result).toBeNull();
  });
});
