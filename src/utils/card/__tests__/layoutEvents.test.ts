import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pushLayoutEvent,
  getLayoutEvents,
  clearLayoutEvents,
} from '../layoutEvents';

describe('layoutEvents', () => {
  beforeEach(() => {
    clearLayoutEvents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes and retrieves events', () => {
    pushLayoutEvent({ type: 'grid.move', side: 'front', element: 'name', result: 'ok' });
    const events = getLayoutEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('grid.move');
    expect(events[0].element).toBe('name');
    expect(events[0].ts).toMatch(/\d{4}-/);
  });

  it('caps at 100 events', () => {
    for (let i = 0; i < 105; i++) {
      pushLayoutEvent({ type: 'grid.move', result: 'ok' });
    }
    expect(getLayoutEvents().length).toBe(100);
  });

  it('logs card.edit events to console in test mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    pushLayoutEvent({ type: 'card.edit', side: 'front', element: 'name', result: 'ok' });
    expect(spy).toHaveBeenCalled();
    const firstArg = String(spy.mock.calls[0]?.[0] ?? '');
    expect(firstArg).toContain('[card-layout]');
    expect(firstArg).toContain('card.edit');
  });
});
