export interface CardQuickAction {
  mode: string;
  label: string;
  title?: string;
  prompt: string;
}

export const CARD_QUICK_ACTIONS: CardQuickAction[] = [
  {
    mode: 'premium',
    label: 'Rendi premium',
    prompt: 'Rendi questo bigliettino più elegante e professionale: scegli un accent color sofisticato (navy #1e3a5f, bordeaux #8b0000, o teal #01696F), usa layout "split" se c\'è foto o "centered" se non c\'è, font Inter, borderStyle "accent-strip-left".',
  },
  {
    mode: 'minimal',
    label: 'Minimal',
    prompt: 'Pulisci il bigliettino: rimuovi i social con URL vuoto o "XXXXX", svuota i campi non compilati, accent color neutro #333333, layout "left", borderStyle "thin". Mantieni solo nome, titolo, telefono, email, website.',
  },
  {
    mode: 'fill',
    label: 'Compila da nome',
    prompt: 'Dai nome del bigliettino, genera un titolo professionale plausibile (es. "Sviluppatore Web", "Designer", "Consulente"), suggerisci un\'azienda se rintracciabile, aggiungi social placeholder con URL "XXXXX" per LinkedIn.',
  },
  {
    mode: 'palette',
    label: 'Cambia palette',
    prompt: 'Cambia la palette con una predefinita: teal (#01696F accent, #1a1a2e text, #FFFFFF bg), navy (#1e3a5f accent, #f8f9fa text, #ffffff bg), bordeaux (#8b0000 accent, #fff8f0 text, #ffffff bg), o monochrome (#333333 accent, #ffffff text, #f5f5f5 bg). Mantieni contrasto WCAG AA.',
  },
  {
    mode: 'print',
    label: 'Ottimizza per stampa',
    prompt: 'Verifica e ottimizza per stampa: contrasto textColor/bgColor >= 4.5:1, font leggibili (Inter, Roboto, Open Sans), evita borderStyle "none" se accent è chiaro.',
  },
  {
    mode: 'moveQr',
    label: '← Sposta QR',
    title: 'Sposta il QR a sinistra',
    prompt: 'Sposta il QR più a sinistra: imposta grid.elements.qr.x = 0 (se non lo è già). Se il QR è già a x=0, puoi ridurre grid.elements.qr.w leggermente.',
  },
  {
    mode: 'growPhoto',
    label: '↔ Allarga foto',
    title: 'Allarga la foto',
    prompt: 'Allarga la foto: aumenta grid.elements.photo.w di 1.',
  },
];

export function findCardQuickAction(mode: string): CardQuickAction | undefined {
  return CARD_QUICK_ACTIONS.find((a) => a.mode === mode);
}
