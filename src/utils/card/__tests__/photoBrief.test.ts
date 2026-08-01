import { describe, it, expect } from 'vitest';
import { buildCardPhotoBrief } from '../photoBrief';
import { createEmptyCard } from '../../documentSchemas';

describe('buildCardPhotoBrief', () => {
  it('includes profession and services in prompt/context', () => {
    const card = createEmptyCard();
    card.front.title = 'Dogsitter';
    card.front.company = 'PetCare';
    card.back.services = ['Dog walking', 'Pet sitting'];
    card.style.accentColor = '#01696F';
    card.style.bgColor = '#FFFFFF';

    const brief = buildCardPhotoBrief(card);
    expect(brief.prompt).toMatch(/Dogsitter/i);
    expect(brief.prompt).toMatch(/Dog walking/i);
    expect(brief.prompt).toMatch(/#01696F/);
    expect(brief.context).toMatch(/Dogsitter/);
    expect(brief.context).toMatch(/PetCare/);
    expect(brief.prompt.length).toBeLessThanOrEqual(1000);
  });

  it('falls back when title is empty', () => {
    const card = createEmptyCard();
    card.front.title = '';
    card.front.company = 'Studio Verde';
    const brief = buildCardPhotoBrief(card);
    expect(brief.prompt).toMatch(/Studio Verde|professionista/i);
  });

  it('forbids text and logos in the image', () => {
    const brief = buildCardPhotoBrief(createEmptyCard());
    expect(brief.prompt.toLowerCase()).toMatch(/free of any text/);
    expect(brief.prompt.toLowerCase()).toMatch(/logos/);
  });

  it('does not crash when style is undefined (AI partial card, CON bug auto-build)', () => {
    const card = createEmptyCard();
    card.front.title = 'Barista';
    card.front.company = 'Caffè Roma';
    const partial = { ...card, style: undefined } as unknown as typeof card;
    const brief = buildCardPhotoBrief(partial);
    expect(brief.prompt).toMatch(/Barista/i);
    expect(brief.prompt).toMatch(/Caffè Roma/i);
    expect(brief.context).toMatch(/Palette/);
  });
});
