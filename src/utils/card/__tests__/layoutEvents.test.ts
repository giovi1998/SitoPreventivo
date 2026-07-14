import { describe, it, expect } from 'vitest';
import {
  pushLayoutEvent,
  getLayoutEvents,
  clearLayoutEvents,
} from '../layoutEvents';

describe('layoutEvents', () => {
  it('pushes and retrieves events', () => {
    clearLayoutEvents();
    pushLayoutEvent({ type: 'grid.move', side: 'front', element: 'name', result: 'ok' });
    const events = getLayoutEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('grid.move');
    expect(events[0].element).toBe('name');
    expect(events[0].ts).toMatch(/\d{4}-/);
  });

  it('caps at 100 events', () => {
    clearLayoutEvents();
    for (let i = 0; i < 105; i++) {
      pushLayoutEvent({ type: 'grid.move', result: 'ok' });
    }
    expect(getLayoutEvents().length).toBe(100);
  });
});
