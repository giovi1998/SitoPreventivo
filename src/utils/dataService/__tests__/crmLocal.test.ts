import { describe, it, expect, beforeEach, vi } from 'vitest';
import dataService from '../../dataService';

Object.defineProperty(window, 'location', {
  value: { hostname: 'localhost' },
  writable: true,
  configurable: true,
});

vi.mock('../../core', async () => {
  const actual = await vi.importActual('../../core');
  return { ...actual };
});

beforeEach(() => {
  localStorage.clear();
});

describe('updateCustomer locale (TB-033 strip undefined)', () => {
  it('patch con undefined/"" non clobbera i campi esistenti', async () => {
    const created = await dataService.createCustomer({
      businessName: 'Pizzeria Test',
      font: 'Edu VIC WA NT Hand Precursive',
      preferredColors: '#B91C1C',
    });
    const id = created.data.id;

    const res = await dataService.updateCustomer(id, { font: undefined, preferredColors: '', skipSync: true });

    expect(res.data.font).toBe('Edu VIC WA NT Hand Precursive');
    expect(res.data.preferredColors).toBe('#B91C1C');
  });

  it('valori validi sovrascrivono', async () => {
    const created = await dataService.createCustomer({ businessName: 'Bar Test', font: 'Poppins' });
    const id = created.data.id;

    const res = await dataService.updateCustomer(id, { font: 'Inter', skipSync: true });

    expect(res.data.font).toBe('Inter');
  });
});
