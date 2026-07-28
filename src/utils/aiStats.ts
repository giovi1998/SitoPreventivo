import { z } from 'zod';

export const AI_CALL_KINDS = [
  'text',
  'cover',
  'photo',
  'icon',
  'hero',
  'background',
  'flyerCopy',
  'logoConcept',
  'socialCopy',
  'quoteCopy',
  'visionReview',
] as const;
export type AiCallKind = (typeof AI_CALL_KINDS)[number];

export const aiCallKindSchema = z.enum(AI_CALL_KINDS);

export const aiCallEntrySchema = z.object({
  count: z.number().int().min(0).default(0),
  costUsd: z.number().min(0).default(0),
});
export type AiCallEntry = z.infer<typeof aiCallEntrySchema>;

export const aiStatsSchema = z
  .object({
    totalCostUsd: z.number().min(0).default(0),
    calls: z.record(z.string(), aiCallEntrySchema).default({}),
    updatedAt: z.string().optional(),
  })
  .default({ totalCostUsd: 0, calls: {} });
export type AiStats = z.infer<typeof aiStatsSchema>;

export const EMPTY_AI_STATS: AiStats = { totalCostUsd: 0, calls: {} };

export const AI_CALL_LABELS: Record<AiCallKind, { singular: string; plural: string }> = {
  text: { singular: 'elaborazione testo', plural: 'elaborazioni testo' },
  cover: { singular: 'cover', plural: 'cover' },
  photo: { singular: 'foto', plural: 'foto' },
  icon: { singular: 'icona', plural: 'icone' },
  hero: { singular: 'immagine hero', plural: 'immagini hero' },
  background: { singular: 'sfondo logo', plural: 'sfondi logo' },
  flyerCopy: { singular: 'testo volantino', plural: 'testi volantino' },
  logoConcept: { singular: 'concept logo', plural: 'concept logo' },
  socialCopy: { singular: 'testo social', plural: 'testi social' },
  quoteCopy: { singular: 'testo preventivo', plural: 'testi preventivo' },
  visionReview: { singular: 'analisi visiva', plural: 'analisi visive' },
};

export function incrementAiStats(
  stats: AiStats | undefined,
  kind: AiCallKind,
  costUsd: number,
): AiStats {
  const base = stats ?? EMPTY_AI_STATS;
  const prev = base.calls[kind] ?? { count: 0, costUsd: 0 };
  const next: AiCallEntry = {
    count: prev.count + 1,
    costUsd: Math.round((prev.costUsd + Math.max(0, costUsd)) * 1_000_000) / 1_000_000,
  };
  const calls = { ...base.calls, [kind]: next };
  const totalCostUsd = Math.round(
    (Object.values(calls).reduce((s, e) => s + e.costUsd, 0)) * 1_000_000,
  ) / 1_000_000;
  return { totalCostUsd, calls, updatedAt: new Date().toISOString() };
}

export function aiStatsTotalCalls(stats: AiStats | undefined): number {
  if (!stats) return 0;
  return Object.values(stats.calls).reduce((s, e) => s + e.count, 0);
}

export function documentAiStatsTitle(aiStats?: AiStats): string {
  const compact = formatAiStatsCompact(aiStats);
  if (!compact) return 'Nessuna chiamata AI registrata su questo documento';
  return `Costo AI cumulato: ${compact}`;
}

export function formatAiStatsCompact(stats: AiStats | undefined): string {
  if (!stats || aiStatsTotalCalls(stats) === 0) return '';
  const parts: string[] = [];
  for (const kind of AI_CALL_KINDS) {
    const entry = stats.calls[kind];
    if (!entry || entry.count === 0) continue;
    const label = entry.count === 1 ? AI_CALL_LABELS[kind].singular : AI_CALL_LABELS[kind].plural;
    parts.push(`${entry.count} ${label}`);
  }
  if (parts.length > 0) {
    const cost = stats.totalCostUsd ?? 0;
    parts.push(`$${cost.toFixed(cost < 1 && cost > 0 ? 4 : 2)}`);
  }
  return parts.join(' · ');
}

export function mergeAiStats(a: AiStats | undefined, b: AiStats | undefined): AiStats {
  if (!a && !b) return EMPTY_AI_STATS;
  if (!a) return b!;
  if (!b) return a;
  const calls: Record<string, AiCallEntry> = { ...a.calls };
  for (const kind of AI_CALL_KINDS) {
    const ea = a.calls[kind];
    const eb = b.calls[kind];
    if (!ea && !eb) continue;
    calls[kind] = {
      count: (ea?.count ?? 0) + (eb?.count ?? 0),
      costUsd: Math.round(((ea?.costUsd ?? 0) + (eb?.costUsd ?? 0)) * 1_000_000) / 1_000_000,
    };
  }
  const totalCostUsd = Math.round(
    Object.values(calls).reduce((s, e) => s + e.costUsd, 0) * 1_000_000,
  ) / 1_000_000;
  return { totalCostUsd, calls, updatedAt: b.updatedAt ?? a.updatedAt };
}

export function withAiCall<T extends { aiStats?: AiStats }>(doc: T, kind: AiCallKind, costUsd: number): T {
  return { ...doc, aiStats: incrementAiStats(doc.aiStats, kind, costUsd) };
}