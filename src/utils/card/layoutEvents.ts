// Layout event bus: structured, lightweight observability for card grid and export.
// Test/debug only by default; production uses existing logger for export errors.

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
  | 'layout.audit';

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

export function pushLayoutEvent(e: Omit<CardLayoutEvent, 'ts'>): void {
  const event: CardLayoutEvent = { ts: new Date().toISOString(), ...e };
  events = [...events.slice(-MAX_EVENTS + 1), event];
  if (typeof window !== 'undefined' && (window as any).__cardLayoutEventsEnabled) {
    try {
      (window as any).__cardLayoutEvents = events;
    } catch {
      // ignore if window is frozen/sealed
    }
  }
  // Mirror to console in dev/test so humans can tail logs without typing commands.
  if (typeof console !== 'undefined' && isDevOrTest()) {
    const label = `%c[card-layout] ${event.type}`;
    const style = 'color: #01696F; font-weight: 600;';
    if (event.result === 'blocked') {
      console.warn(label, style, event);
    } else if (event.result === 'error') {
      console.error(label, style, event);
    } else {
      console.log(label, style, event);
    }
  }
}

function isDevOrTest(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    import.meta.env;
    const mode = (import.meta as any).env?.MODE;
    if (mode === 'development' || mode === 'test') return true;
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
  return false;
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
