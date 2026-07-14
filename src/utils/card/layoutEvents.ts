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
  events = [...events.slice(-MAX_EVENTS + 1), { ts: new Date().toISOString(), ...e }];
  if (typeof window !== 'undefined' && (window as any).__cardLayoutEventsEnabled) {
    try {
      (window as any).__cardLayoutEvents = events;
    } catch {
      // ignore if window is frozen/sealed
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
