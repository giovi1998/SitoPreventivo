import { describe, it, expect } from 'vitest';
import { aiInputQuoteSchema } from '../aiQuoteInputSchema';
import { createEmptyQuote, addEmptyOption, addEmptyItem } from '../../utils/quoteSchema';

function makeBaseWithItem() {
  const withOpt = addEmptyOption(createEmptyQuote());
  return addEmptyItem(withOpt, withOpt.options[0].id);
}

describe('aiInputQuoteSchema', () => {
  it('accepts AI response with options that lack summary and total (they are computed)', () => {
    const base = makeBaseWithItem();
    const optId = base.options[0].id;
    const itemId = base.options[0].items[0].id;
    const aiResponse = {
      options: [
        {
          id: optId,
          label: 'Nuova opzione',
          description: 'desc',
          isDefault: true,
          selectionType: 'single',
          items: [
            {
              id: itemId,
              label: 'Item',
              description: 'desc item',
              category: 'service',
              unit: 'fixed',
              quantity: 1,
              unitPrice: 100,
              discount: { type: 'none', value: 0 },
              tax: { type: 'vat', rate: 22 },
            },
          ],
        },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts AI response with legalClauses only (no options, no project)', () => {
    const aiResponse = {
      legalClauses: [
        { id: 'cl-1', title: 'FAQ', body: 'Domande frequenti', language: 'it' },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts AI response that only updates project title', () => {
    const result = aiInputQuoteSchema.safeParse({ project: { title: 'Nuovo' } });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (AI sent nothing useful)', () => {
    const result = aiInputQuoteSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid enum value for item.unit', () => {
    const base = makeBaseWithItem();
    const optId = base.options[0].id;
    const itemId = base.options[0].items[0].id;
    const aiResponse = {
      options: [
        {
          id: optId,
          label: 'x',
          description: '',
          isDefault: false,
          selectionType: 'single',
          items: [
            {
              id: itemId,
              label: 'Item',
              category: 'service',
              unit: 'invalid_unit',
              quantity: 1,
              unitPrice: 100,
              discount: { type: 'none', value: 0 },
              tax: { type: 'vat', rate: 22 },
            },
          ],
        },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(false);
  });

  it('rejects negative unitPrice', () => {
    const base = makeBaseWithItem();
    const optId = base.options[0].id;
    const itemId = base.options[0].items[0].id;
    const aiResponse = {
      options: [
        {
          id: optId,
          label: 'x',
          description: '',
          isDefault: false,
          selectionType: 'single',
          items: [
            {
              id: itemId,
              label: 'Item',
              category: 'service',
              unit: 'fixed',
              quantity: 1,
              unitPrice: -50,
              discount: { type: 'none', value: 0 },
              tax: { type: 'vat', rate: 22 },
            },
          ],
        },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(false);
  });

  it('accepts AI response without discount/tax (optional in input)', () => {
    const base = makeBaseWithItem();
    const optId = base.options[0].id;
    const itemId = base.options[0].items[0].id;
    const aiResponse = {
      options: [
        {
          id: optId,
          label: 'x',
          description: '',
          isDefault: false,
          selectionType: 'single',
          items: [
            {
              id: itemId,
              label: 'Item',
              category: 'service',
              unit: 'fixed',
              quantity: 1,
              unitPrice: 100,
            },
          ],
        },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts legalClauses with "content" field (AI variant of "body")', () => {
    const aiResponse = {
      legalClauses: [
        { id: 'clause-1', title: 'Condizioni Generali', content: 'Testo della clausola' },
      ],
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts paymentTerms with deposit/dueDays/notes (AI variant)', () => {
    const aiResponse = {
      paymentTerms: {
        method: 'bonifico bancario',
        deposit: 50,
        dueDays: 30,
        notes: 'Pagamento 50% all\'ordine',
      },
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts uiPreferences with logoUrl', () => {
    const aiResponse = {
      uiPreferences: {
        accentColor: '#2c3e50',
        fontFamily: 'Arial',
        logoUrl: 'https://example.com/logo.png',
      },
    };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });

  it('accepts notes as a plain string (AI variant)', () => {
    const aiResponse = { notes: 'I prezzi non includono l\'IVA' };
    const result = aiInputQuoteSchema.safeParse(aiResponse);
    expect(result.success).toBe(true);
  });
});
