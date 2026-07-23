import { describe, it, expect } from 'vitest';
import { renderFlyerPreviewImage } from '../flyerPreviewImage';
import { createEmptyFlyer } from '../../documentSchemas';

describe('renderFlyerPreviewImage', () => {
  it('returns null in jsdom (canvas not available)', async () => {
    const flyer = createEmptyFlyer();
    flyer.content.headline = 'Test headline';
    const result = await renderFlyerPreviewImage(flyer);
    expect(result).toBeNull();
  });
});
