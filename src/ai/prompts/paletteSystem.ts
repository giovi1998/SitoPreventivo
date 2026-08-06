// TB-027 B5: palette prompt builder. DeepSeek → JSON array di 3 palette.
// lean-code: prompt inline nel builder, niente file prompt separato (YAGNI).

export interface PaletteBrief {
  businessName: string;
  sector?: string | null;
  mood?: string | null;
  target?: string | null;
  activity?: string | null;
}

export function buildPaletteSystemPrompt(): string {
  return `Sei un brand designer esperto. Generi 3 palette colori coerenti con il brief del cliente.
Rispondi SEMPRE con un array JSON di 3 oggetti palette, ognuno con:
- name: nome breve della palette (es "Caldo Tradizionale", max 30 char)
- primary: colore primario #RRGGBB
- secondary: colore secondario #RRGGBB
- accent: colore accento #RRGGBB
- bg: colore sfondo #RRGGBB
- text: colore testo #RRGGBB
- rationale: una frase (max 120 char) che spiega la scelta

Le 3 palette devono essere visivamente distinte (non varianti della stessa).
Adatta i colori al settore e al mood richiesto. Niente testo fuori dal JSON.`;
}

export function buildPaletteUserPrompt(brief: PaletteBrief): string {
  const parts = [brief.businessName];
  if (brief.sector) parts.push(`settore: ${brief.sector}`);
  if (brief.mood) parts.push(`mood: ${brief.mood}`);
  if (brief.target) parts.push(`target: ${brief.target}`);
  if (brief.activity) parts.push(`attività: ${brief.activity}`);
  return `Genera 3 palette colori per questo brand: ${parts.join(', ')}.`;
}