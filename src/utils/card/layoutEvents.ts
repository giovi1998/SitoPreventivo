// Layout event bus: structured, lightweight observability for card grid,
// form edits, media uploads and export. In DEV/test every event is also
// printed to the browser console as `[card-layout] …`.

export type CardLayoutEventType =
  | 'grid.toggle'
  | 'grid.side'
  | 'grid.select'
  | 'grid.move'
  | 'grid.resize'
  | 'grid.align'
  | 'grid.preset'
  | 'export.start'
  | 'export.success'
  | 'export.error'
  | 'layout.audit'
  | 'card.edit'
  | 'card.template'
  | 'card.reset'
  | 'card.media'
  | 'card.ai';

export interface CardLayoutEvent {
  ts: string;
  type: CardLayoutEventType;
  side?: 'front' | 'back';
  element?: string;
  payload?: Record<string, unknown>;
  result?: 'ok' | 'blocked' | 'error';
  reason?: string;
}

const MAX_EVENTS = 100;
let events: CardLayoutEvent[] = [];

function isDevOrTest(): boolean {
  try {
    const env = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string; PROD?: boolean } }).env;
    // Vite sets DEV=true in `npm run dev`. Also treat non-PROD browser as debug.
    if (env?.DEV === true) return true;
    if (env?.MODE === 'development' || env?.MODE === 'test') return true;
    if (env?.PROD === false) return true;
  } catch {
    // not an ES module environment
  }
  try {
    if (typeof process !== 'undefined' && process.env && (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')) {
      return true;
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('pq_card_layout_debug') === '1') return true;
      // Host heuristic: local dev servers always log.
      const host = window.location?.hostname ?? '';
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function pushLayoutEvent(e: Omit<CardLayoutEvent, 'ts'>): void {
  const event: CardLayoutEvent = { ts: new Date().toISOString(), ...e };
  events = [...events.slice(-MAX_EVENTS + 1), event];
  const debug = isDevOrTest();

  // Always keep window hook fresh when enabled OR in dev/test/localhost.
  if (typeof window !== 'undefined' && ((window as any).__cardLayoutEventsEnabled || debug)) {
    try {
      (window as any).__cardLayoutEventsEnabled = true;
      (window as any).__cardLayoutEvents = events;
    } catch {
      // ignore if window is frozen/sealed
    }
  }

  // Mirror to console so humans can tail logs without typing commands.
  // Use plain string first arg (no %c) so Chrome "Default levels" never hides it.
  if (typeof console !== 'undefined' && debug) {
    const label = `[card-layout] ${event.type}${event.element ? ' · ' + event.element : ''}${event.reason ? ' · ' + event.reason : ''}`;
    if (event.result === 'blocked') {
      console.warn(label, event);
    } else if (event.result === 'error') {
      console.error(label, event);
    } else {
      // info is always visible under Chrome "Default levels" (Verbose is off by default)
      console.info(label, event);
    }
  }
}

export function getLayoutEvents(): readonly CardLayoutEvent[] {
  return events;
}

export function clearLayoutEvents(): void {
  events = [];
}

export function attachLayoutEventsToWindow(): void {
  if (typeof window === 'undefined') return;
  (window as any).__cardLayoutEventsEnabled = true;
  (window as any).__cardLayoutEvents = events;
}

export function detachLayoutEventsFromWindow(): void {
  if (typeof window === 'undefined') return;
  (window as any).__cardLayoutEventsEnabled = false;
  try {
    delete (window as any).__cardLayoutEvents;
  } catch {
    // ignore
  }
}
