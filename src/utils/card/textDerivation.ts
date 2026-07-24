import type { BusinessCard } from '../documentSchemas';

export function computeMonogram(card: BusinessCard): string {
  const name = card.front.name;
  if (!name) return '';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

export function deriveHostname(card: BusinessCard): string {
  const website = card.back.website;
  if (!website) return '';
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

export function deriveHandle(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (['linkedin.com', 'github.com', 'twitter.com', 'x.com', 'instagram.com'].includes(host)) {
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      const handle = path.split('/').filter(Boolean).pop() || '';
      return handle ? `@${handle}` : '';
    }
    return u.pathname.replace(/^\/+|\/+$/g, '') || host;
  } catch {
    return url;
  }
}
