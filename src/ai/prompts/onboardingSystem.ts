/**
 * Onboarding AI system + suggest prompt. Suggests displayName,
 * company/profession options and a default color based on name +
 * optional sector. Consumed by future OnboardingAIOrchestrator (spec 13).
 */

const SECTOR_DEFAULT_COLORS: Record<string, string> = {
  ristorante: '#E62020',
  food: '#E62020',
  tech: '#01696F',
  fashion: '#1A1A1A',
  beauty: '#8b0000',
  'studio professionale': '#1e3a5f',
  default: '#1A1A1A',
};

const SECTOR_PROFESSIONS: Record<string, string[]> = {
  ristorante: ['Chef', 'Ristoratore', 'Cucina'],
  food: ['Chef', 'Ristoratore', 'Pasticciere'],
  tech: ['Sviluppatore', 'Consulente IT', 'Designer'],
  fashion: ['Designer', 'Sartore', 'Stylist'],
  beauty: ['Estetista', 'Parrucchiere', 'Beauty expert'],
  'studio professionale': ['Professionista', 'Consulente', 'Avvocato'],
  default: ['Professionista', 'Imprenditore', 'Consulente'],
};

export function buildOnboardingSystemPrompt(): string {
  return `Sei l'assistente AI per suggerire dati di onboarding Quickbrand.
Output: SOLO JSON valido con questo contract:
{
  "displayName": "string, max 40 char, nome visualizzato",
  "companySuggestions": ["string, max 60 char, 3 opzioni"],
  "professionSuggestions": ["string, max 50 char, 3 opzioni"],
  "defaultColor": "#RRGGBB, colore brand suggerito"
}

REGOLE:
- displayName = nome proprio (es. "Giovanni" → "Giovanni", non "Giovanni Cidu" se non fornito cognome).
- companySuggestions: 3 nomi azienda plausibili per settore.
- professionSuggestions: 3 professioni plausibili per settore.
- defaultColor: colore coerente col settore (vedi mapping sotto), o #1A1A1A se settore assente.
- NON inventare email, telefono, indirizzo, codice fiscale. Solo i 4 campi contract.
- Lingua: italiano.`;
}

export function buildOnboardingSuggestPrompt(name: string, sector?: string): string {
  const safeName = sanitizeOnboardingName(name);
  const safeSector = (sector ?? '').toLowerCase().trim();
  const defaultColor = SECTOR_DEFAULT_COLORS[safeSector] ?? SECTOR_DEFAULT_COLORS.default;
  const professions = SECTOR_PROFESSIONS[safeSector] ?? SECTOR_PROFESSIONS.default;

  return `Genera suggerimenti per il seguente utente:

Nome: "${safeName}"
${safeSector ? `Settore: ${safeSector}` : 'Settore: (non specificato, usa default generici)'}

Hints (linee guida, l'AI può discostarsi se appropriato):
- defaultColor suggerito: ${defaultColor}
- professioni tipiche: ${professions.join(', ')}

Rispondi con SOLO il JSON contract. Massimo 3 opzioni per company/profession.`;
}

export function sanitizeOnboardingName(name: string): string {
  return name
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}
