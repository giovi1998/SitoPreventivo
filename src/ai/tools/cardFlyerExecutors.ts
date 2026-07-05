/**
 * Executor puri per i tool di card e flyer. Stateless: data
 * l'args e il payload, ritornano `{ payload: aggiornato, changes }`.
 * Cast interno al tipo BusinessCard o Flyer (gli orchestratori
 * passano già i tipi corretti; spec 9 mantiene type-safety runtime
 * via la validazione dello schema Zod sul payload in ingresso).
 */

export interface CardToolResult {
  payload: unknown;
  changes: string;
}

const CARD_PALETTES: Record<string, { bg: string; text: string; accent: string }> = {
  premium: { bg: '#ffffff', text: '#1a1a1a', accent: '#1e3a5f' },
  minimal: { bg: '#ffffff', text: '#1a1a1a', accent: '#333333' },
  moderno: { bg: '#0F1117', text: '#ffffff', accent: '#FF3B3B' },
  classico: { bg: '#ffffff', text: '#1A1A1A', accent: '#E62020' },
};

export function executeCardApplyPalette(
  args: { palette?: string },
  payload: unknown,
): CardToolResult {
  const card = payload as {
    style?: { bgColor?: string; textColor?: string; accentColor?: string; [k: string]: unknown };
    [k: string]: unknown;
  };
  const set = CARD_PALETTES[args.palette ?? ''];
  if (!set) {
    return { payload: card, changes: `Palette sconosciuta: ${args.palette ?? '(vuota)'}` };
  }
  return {
    payload: {
      ...card,
      style: { ...(card.style ?? {}), bgColor: set.bg, textColor: set.text, accentColor: set.accent },
    },
    changes: `Palette ${args.palette} applicata: accent=${set.accent}`,
  };
}

export function executeCardSwitchLayout(
  args: { layout?: string },
  payload: unknown,
): CardToolResult {
  const valid = ['centered', 'left', 'split', 'right', 'top', 'bottom', 'minimal', 'photo-circle', 'compact'];
  const card = payload as { front?: { layout?: string }; [k: string]: unknown };
  if (!args.layout || !valid.includes(args.layout)) {
    return { payload: card, changes: `Layout non valido: ${args.layout ?? '(vuoto)'}` };
  }
  return {
    payload: { ...card, front: { ...(card.front ?? {}), layout: args.layout } },
    changes: `Layout frontale cambiato a ${args.layout}`,
  };
}

const MAX_SERVICES = 8;

export function executeCardAddService(
  args: { service?: string },
  payload: unknown,
): CardToolResult {
  const card = payload as { back?: { services?: string[] }; [k: string]: unknown };
  const service = (args.service ?? '').trim();
  if (!service) return { payload: card, changes: 'Servizio vuoto' };
  if (service.length > 80) return { payload: card, changes: 'Servizio oltre 80 caratteri' };
  const services = card.back?.services ?? [];
  if (services.length >= MAX_SERVICES) {
    return { payload: card, changes: `max ${MAX_SERVICES} servizi raggiunto` };
  }
  return {
    payload: { ...card, back: { ...(card.back ?? {}), services: [...services, service] } },
    changes: `Servizio aggiunto: "${service}"`,
  };
}

export function executeCardRemoveEmptySocials(
  _args: Record<string, unknown>,
  payload: unknown,
): CardToolResult {
  const card = payload as { back?: { socials?: Array<{ platform?: string; url?: string }> }; [k: string]: unknown };
  const socials = card.back?.socials ?? [];
  const filtered = socials.filter((s) => {
    const url = (s.url ?? '').trim();
    return url && url !== 'XXXXX';
  });
  const removed = socials.length - filtered.length;
  return {
    payload: { ...card, back: { ...(card.back ?? {}), socials: filtered } },
    changes: removed > 0 ? `Rimossi ${removed} social vuoti/placeholder` : 'Nessun social da rimuovere',
  };
}

export function executeFlyerShortenBody(
  args: { ratio?: number },
  payload: unknown,
): CardToolResult {
  const flyer = payload as { content?: { body?: string; [k: string]: unknown }; [k: string]: unknown };
  const ratio = args.ratio ?? 0.5;
  if (ratio < 0.3 || ratio > 0.8) {
    return { payload: flyer, changes: `Ratio fuori range [0.3, 0.8]: ${ratio}` };
  }
  const body = flyer.content?.body ?? '';
  const target = Math.max(1, Math.floor(body.length * ratio));
  const newBody = body.slice(0, target).trimEnd() + (target < body.length ? '…' : '');
  return {
    payload: { ...flyer, content: { ...(flyer.content ?? {}), body: newBody } },
    changes: `Body ridotto da ${body.length} a ${newBody.length} char (${Math.round(ratio * 100)}%)`,
  };
}

export function executeFlyerAddUrgency(
  args: { phrase?: string },
  payload: unknown,
): CardToolResult {
  const flyer = payload as { content?: { body?: string; cta?: { label?: string }; [k: string]: unknown }; [k: string]: unknown };
  const phrase = (args.phrase ?? '').trim();
  if (!phrase) return { payload: flyer, changes: 'Frase urgenza vuota' };
  if (phrase.length > 50) return { payload: flyer, changes: 'Frase urgenza oltre 50 caratteri' };
  const body = flyer.content?.body ?? '';
  const newBody = body ? `${body} ${phrase}` : phrase;
  return {
    payload: { ...flyer, content: { ...(flyer.content ?? {}), body: newBody } },
    changes: `Urgenza aggiunta: "${phrase}"`,
  };
}

/**
 * Note: flyer_change_tone richiede una seconda chiamata LLM, quindi
 * non ha un executor puro. L'orchestratore gestisce il dispatch
 * applicando il tool come marker (emette il prompt refine) e poi
 * esegue una nuova round-trip DeepSeek con il tono specificato.
 */
