import { describe, it, expect, beforeEach } from 'vitest';
import { loadRunState, saveRunState, clearRunState } from '../runState';

describe('runState (t17)', () => {
  const base = {
    runId: 'run-1',
    customerId: 'cust_1',
    startedAt: Date.now(),
    steps: [{ step: 'logo', status: 'done' as const }, { step: 'card', status: 'error' as const }],
  };

  beforeEach(() => clearRunState());

  it('save + load roundtrip', () => {
    saveRunState(base);
    expect(loadRunState('cust_1')).toEqual(base);
  });

  it('customerId diverso → null', () => {
    saveRunState(base);
    expect(loadRunState('cust_2')).toBeNull();
  });

  it('stale (>30 min) → null', () => {
    saveRunState({ ...base, startedAt: Date.now() - 31 * 60 * 1000 });
    expect(loadRunState('cust_1')).toBeNull();
  });

  it('clearRunState rimuove la chiave', () => {
    saveRunState(base);
    clearRunState();
    expect(sessionStorage.getItem('pq_autobuild_run:v1')).toBeNull();
  });
});
