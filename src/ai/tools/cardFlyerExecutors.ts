/**
 * Executor puri per i tool di card e flyer. Stateless: data
 * l'args e il payload, ritornano `{ payload: aggiornato, changes }`.
 * Cast interno al tipo BusinessCard o Flyer (gli orchestratori
 * passano già i tipi corretti; spec 9 mantiene type-safety runtime
 * via la validazione dello schema Zod sul payload in ingresso).
 */

import type { ToolResult } from '../types';

type WithStyle<T> = T & { style?: { bgColor?: string; textColor?: string; accentColor?: string; [k: string]: unknown } };
type WithFront<T> = T & { front?: { layout?: string; [k: string]: unknown }; [k: string]: unknown };
type WithBackServices<T> = T & { back?: { services?: string[]; [k: string]: unknown }; [k: string]: unknown };
type WithBackSocials<T> = T & { back?: { socials?: Array<{ platform?: string; url?: string }>; [k: string]: unknown }; [k: string]: unknown };
type WithContent<T> = T & { content?: { body?: string; cta?: { label?: string }; [k: string]: unknown }; [k: string]: unknown };

const CARD_PALETTES: Record<string, { bg: string; text: string; accent: string }> = {
  premium: { bg: '#ffffff', text: '#1a1a1a', accent: '#1e3a5f' },
  minimal: { bg: '#ffffff', text: '#1a1a1a', accent: '#333333' },
  moderno: { bg: '#0F1117', text: '#ffffff', accent: '#FF3B3B' },
  classico: { bg: '#ffffff', text: '#1A1A1A', accent: '#E62020' },
};

export function executeCardApplyPalette<T>(
  args: { palette?: string },
  payload: WithStyle<T>,
): ToolResult<WithStyle<T>> {
  const set = CARD_PALETTES[args.palette ?? ''];
  if (!set) {
    return { payload, changes: `Palette sconosciuta: ${args.palette ?? '(vuota)'}` };
  }
  return {
    payload: {
      ...payload,
      style: { ...(payload.style ?? {}), bgColor: set.bg, textColor: set.text, accentColor: set.accent },
    },
    changes: `Palette ${args.palette} applicata: accent=${set.accent}`,
  };
}

export function executeCardSwitchLayout<T>(
  args: { layout?: string },
  payload: WithFront<T>,
): ToolResult<WithFront<T>> {
  const valid = ['centered', 'left', 'split', 'right', 'top', 'bottom', 'minimal', 'photo-circle', 'compact'];
  if (!args.layout || !valid.includes(args.layout)) {
    return { payload, changes: `Layout non valido: ${args.layout ?? '(vuoto)'}` };
  }
  return {
    payload: { ...payload, front: { ...(payload.front ?? {}), layout: args.layout } },
    changes: `Layout frontale cambiato a ${args.layout}`,
  };
}

const MAX_SERVICES = 8;

export function executeCardAddService<T>(
  args: { service?: string },
  payload: WithBackServices<T>,
): ToolResult<WithBackServices<T>> {
  const service = (args.service ?? '').trim();
  if (!service) return { payload, changes: 'Servizio vuoto' };
  if (service.length > 80) return { payload, changes: 'Servizio oltre 80 caratteri' };
  const services = payload.back?.services ?? [];
  if (services.length >= MAX_SERVICES) {
    return { payload, changes: `max ${MAX_SERVICES} servizi raggiunto` };
  }
  return {
    payload: { ...payload, back: { ...(payload.back ?? {}), services: [...services, service] } },
    changes: `Servizio aggiunto: "${service}"`,
  };
}

export function executeCardRemoveEmptySocials<T>(
  _args: Record<string, unknown>,
  payload: WithBackSocials<T>,
): ToolResult<WithBackSocials<T>> {
  const socials = payload.back?.socials ?? [];
  const filtered = socials.filter((s) => {
    const url = (s.url ?? '').trim();
    return url && url !== 'XXXXX';
  });
  const removed = socials.length - filtered.length;
  return {
    payload: { ...payload, back: { ...(payload.back ?? {}), socials: filtered } },
    changes: removed > 0 ? `Rimossi ${removed} social vuoti/placeholder` : 'Nessun social da rimuovere',
  };
}

export function executeFlyerShortenBody<T>(
  args: { ratio?: number },
  payload: WithContent<T>,
): ToolResult<WithContent<T>> {
  const ratio = args.ratio ?? 0.5;
  if (ratio < 0.3 || ratio > 0.8) {
    return { payload, changes: `Ratio fuori range [0.3, 0.8]: ${ratio}` };
  }
  const body = payload.content?.body ?? '';
  const target = Math.max(1, Math.floor(body.length * ratio));
  const newBody = body.slice(0, target).trimEnd() + (target < body.length ? '…' : '');
  return {
    payload: { ...payload, content: { ...(payload.content ?? {}), body: newBody } },
    changes: `Body ridotto da ${body.length} a ${newBody.length} char (${Math.round(ratio * 100)}%)`,
  };
}

export function executeFlyerAddUrgency<T>(
  args: { phrase?: string },
  payload: WithContent<T>,
): ToolResult<WithContent<T>> {
  const phrase = (args.phrase ?? '').trim();
  if (!phrase) return { payload, changes: 'Frase urgenza vuota' };
  if (phrase.length > 50) return { payload, changes: 'Frase urgenza oltre 50 caratteri' };
  const body = payload.content?.body ?? '';
  const newBody = body ? `${body} ${phrase}` : phrase;
  return {
    payload: { ...payload, content: { ...(payload.content ?? {}), body: newBody } },
    changes: `Urgenza aggiunta: "${phrase}"`,
  };
}

/**
 * Note: flyer_change_tone richiede una seconda chiamata LLM, quindi
 * non ha un executor puro. L'orchestratore gestisce il dispatch
 * applicando il tool come marker (emette il prompt refine) e poi
 * esegue una nuova round-trip DeepSeek con il tono specificato.
 */
