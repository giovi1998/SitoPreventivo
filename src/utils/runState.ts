const KEY = 'pq_autobuild_run:v1';
const TTL_MS = 30 * 60 * 1000;

export interface RunStepState {
  step: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface AutoBuildRunState {
  runId: string;
  customerId: string;
  startedAt: number;
  steps: RunStepState[];
}

/** t17: carica lo stato run dal sessionStorage (null se assente/stale). */
export function loadRunState(customerId: string): AutoBuildRunState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as AutoBuildRunState;
    if (state.customerId !== customerId || Date.now() - state.startedAt > TTL_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveRunState(state: AutoBuildRunState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* quota piena: sessionStorage può essere ignorato */ }
}

/** t17: rimuovi lo stato run a fine esecuzione o refresh cliente. */
export function clearRunState(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* no-op */ }
}
