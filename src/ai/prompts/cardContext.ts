import type { BusinessCard } from '../../utils/documentSchemas';

export function detectCardRelevantFields(prompt: string): Set<string> {
  const lower = prompt.toLowerCase();
  const fields = new Set<string>();

  const rules: [string, string[]][] = [
    ['front', ['nome', 'name', 'titolo', 'title', 'ruolo', 'azienda', 'company', 'layout', 'centrato', 'centered', 'split', 'sinistra', 'left']],
    // Phase 2.2: aggiunti keyword per servizi e dimensione QR (nuovi campi)
    ['back', ['telefono', 'phone', 'email', 'sito', 'web', 'website', 'indirizzo', 'address', 'p.iva', 'piva', 'vat', 'social', 'linkedin', 'github', 'instagram', 'qr', 'payload', 'servizio', 'servizi', 'service', 'qrsize']],
    // Phase 2.2: aggiunti keyword per fontScale (dimensione testo) e font
    ['style', ['colore', 'color', 'palette', 'font', 'bordo', 'border', 'formato', 'size', 'premium', 'minimal', 'stile', 'tema', 'testo', 'dimensione', 'scala', 'grande', 'piccolo', 'fontscale']],
    // Phase 2.2 fix: keyword per grid (sposta, scambia, riarrangia)
    ['grid', ['griglia', 'grid', 'sposta', 'scambia', 'posizione', 'sopra', 'sotto', 'sinistra', 'destra', 'logo', 'foto', 'elemento', 'muovi', 'riarrangia', 'swap', 'position']],
    ['analysis', ['stampa', 'print', 'contrasto', 'contrast', 'verifica', 'analizza', 'ottimizza', 'check', 'wcag']],
  ];

  for (const [field, keywords] of rules) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        fields.add(field);
        break;
      }
    }
  }

  // "premium" / "minimal" affect both front (layout) and style
  if (lower.includes('premium') || lower.includes('minimal')) {
    fields.add('front');
    fields.add('style');
  }

  return fields;
}

export interface CardAIContext {
  payload: Record<string, unknown>;
  relevantFields: string[];
}

export function buildCardAIContext(card: BusinessCard, userPrompt: string): CardAIContext {
  const fields = detectCardRelevantFields(userPrompt);
  const payload: Record<string, unknown> = {};

  if (fields.has('front') || fields.size === 0) {
    // Strip photoUrl/logoUrl (base64 too large for AI context)
    const { photoUrl, logoUrl, ...frontRest } = card.front;
    payload.front = frontRest;
  }
  if (fields.has('back') || fields.size === 0) {
    payload.back = card.back;
  }
  // Style is always included (for palette/layout changes)
  payload.style = card.style;

  // Phase 2.2 fix: includi SEMPRE grid e backGrid se presenti, così l'AI
  // può "scambiare", "spostare", "riarrangia" elementi. Senza questo,
  // richieste come "scambia logo con nome" falliscono perché l'AI non
  // vede le posizioni correnti e non sa dove sono gli elementi.
  if (card.grid) {
    payload.grid = card.grid;
  }
  if (card.backGrid) {
    payload.backGrid = card.backGrid;
  }

  const relevantFields = fields.size > 0
    ? Array.from(fields)
    : ['front', 'back', 'style'];

  return { payload, relevantFields };
}
