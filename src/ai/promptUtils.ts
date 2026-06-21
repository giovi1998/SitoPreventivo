/**
 * Heuristics to classify a user prompt as "modify" (apply changes) or
 * "analysis" (just give suggestions). The AI core calls these to decide
 * which response format to use: text-only for analysis, JSON+tools for
 * modify.
 *
 * This module is pure (no I/O) so it is easy to unit-test.
 */

const ANALYSIS_KEYWORDS = [
  'cosa ', 'cosa?', 'cosa.', // cosa (cosa, cosa posso, cosa ne pensi)
  'come ', 'come?', 'come.', // come (come posso, come mai)
  'suggerisci', 'suggerimenti', 'consigli', 'consiglia',
  'analizza', 'analisi', 'esamina', 'valuta',
  'dimmi', 'spiega', 'spiegami', 'perché', 'perche',
  'opinione', 'pensieri', 'parere', 'idea', 'idee',
  'what can', 'what would', 'what should', 'how can', 'how should',
  'suggest', 'suggestion', 'recommend', 'analyze', 'explain',
  'opinion', 'thoughts', 'ideas',
];

/**
 * Returns true if the prompt sounds like the user wants feedback /
 * suggestions / analysis rather than an immediate mutation of the quote.
 *
 * Conservative: when in doubt, returns false (i.e. we treat the prompt as
 * a modify request) so that the user does not lose the ability to apply
 * a direct instruction.
 */
export function needsAnalysis(prompt: string): boolean {
  if (!prompt || !prompt.trim()) return false;
  const lower = prompt.toLowerCase();
  return ANALYSIS_KEYWORDS.some((kw) => lower.includes(kw));
}
