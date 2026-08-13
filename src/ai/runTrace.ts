// T7: helper trace gerarchica agente — id hex stabili per run/span.
// runId = 32-hex (traceId W3C), spanId = 16-hex (8 byte).

export function newHexId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newRunId(): string {
  return newHexId(16);
}

export function newSpanId(): string {
  return newHexId(8);
}
