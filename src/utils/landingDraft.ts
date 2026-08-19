import { exportWebsiteZip } from './websiteExport';
import type { Website } from './schemas/website';

export interface LandingDraftInput {
  businessName: string;
  webAnswers?: Record<string, string | undefined> | null;
  preferredColors?: string | null;
  activity?: string | null;
  contacts?: Record<string, unknown> | null;
  socials?: Array<{ platform?: string; url?: string }> | null;
  logoUrl?: string | null;
  flyer?: {
    content?: { headline?: string; body?: string; cta?: { label?: string } };
    style?: { accentColor?: string };
  } | null;
}

const PALETTE = [
  { name: 'blu', color: 'hsl(210, 70%, 35%)' },
  { name: 'blu notte', color: 'hsl(222, 60%, 22%)' },
  { name: 'oro', color: 'hsl(45, 85%, 45%)' },
  { name: 'rosso', color: 'hsl(0, 70%, 45%)' },
  { name: 'bordeaux', color: 'hsl(340, 60%, 30%)' },
  { name: 'verde', color: 'hsl(140, 55%, 35%)' },
  { name: 'crema', color: 'hsl(40, 60%, 88%)' },
  { name: 'bianco', color: 'hsl(0, 0%, 98%)' },
  { name: 'nero', color: 'hsl(0, 0%, 12%)' },
  { name: 'grigio', color: 'hsl(220, 10%, 45%)' },
  { name: 'viola', color: 'hsl(270, 55%, 40%)' },
  { name: 'rosa', color: 'hsl(330, 60%, 55%)' },
  { name: 'arancio', color: 'hsl(25, 85%, 50%)' },
  { name: 'marrone', color: 'hsl(25, 45%, 35%)' },
  { name: 'legno', color: 'hsl(25, 50%, 40%)' },
  { name: 'teal', color: 'hsl(180, 60%, 35%)' },
  { name: 'celeste', color: 'hsl(200, 80%, 60%)' },
  { name: 'lilla', color: 'hsl(260, 40%, 70%)' },
  { name: 'beige', color: 'hsl(45, 30%, 80%)' },
  { name: 'turchese', color: 'hsl(175, 70%, 40%)' },
];

/** Colore deterministico da una stringa di colori preferiti (nomi o hex). */
export function colorFromName(raw: string): string {
  const s = raw.toLowerCase();
  const hex = s.match(/#[0-9a-f]{3,8}/)?.[0];
  if (hex) return hex;
  for (const p of PALETTE) {
    if (s.includes(p.name)) return p.color;
  }
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 60%, 40%)`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pick(...values: Array<string | undefined | null>): string {
  return values.find((v) => v && v.trim())?.trim() ?? '';
}

function heroImage(logoUrl: string | null | undefined): string {
  if (!logoUrl) return '';
  return `<div class="hero-logo"><img src="${logoUrl}" alt="Logo"></div>`;
}

function contactsHtml(contacts: Record<string, unknown> | null | undefined): string {
  const phone = pick(String(contacts?.phone ?? ''), String(contacts?.telefono ?? ''));
  const email = pick(String(contacts?.email ?? ''));
  const address = pick(String(contacts?.address ?? ''));
  const website = pick(String(contacts?.website ?? ''));
  const rows = [
    phone ? `<li><strong>Telefono:</strong> <a href="tel:${esc(phone)}">${esc(phone)}</a></li>` : '',
    email ? `<li><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></li>` : '',
    address ? `<li><strong>Indirizzo:</strong> ${esc(address)}</li>` : '',
    website ? `<li><strong>Sito:</strong> <a href="${esc(website)}" rel="noopener">${esc(website)}</a></li>` : '',
  ].filter(Boolean);
  if (rows.length === 0) return '';
  return `<section class="section" id="contatti"><h2>Contatti</h2><ul class="contacts">${rows.join('')}</ul></section>`;
}

function socialsHtml(socials: Array<{ platform?: string; url?: string }> | null | undefined): string {
  const items = (socials || []).filter((s) => s.platform || s.url);
  if (items.length === 0) return '';
  return `<div class="socials">${items
    .map((s) => {
      const label = esc(s.platform || s.url || '');
      const href = /^https?:\/\//.test(s.url || '') ? esc(s.url || '') : `https://www.instagram.com/${esc((s.url || '').replace(/^@/, ''))}`;
      return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
    })
    .join('')}</div>`;
}

function footerHtml(businessName: string, socials: Array<{ platform?: string; url?: string }> | null | undefined): string {
  return `<footer><p>© <span class="current-year"></span> ${esc(businessName)}</p>${socialsHtml(socials)}</footer>`;
}

function landingCss(accent: string, tone: string): string {
  const dark = tone.includes('scuro') || tone.includes('dark') || tone.includes('elegante') || tone.includes('luxury');
  const bg = dark ? '#0f1115' : '#ffffff';
  const text = dark ? '#f2f4f8' : '#1a1a2e';
  return `:root{--accent:${accent};--bg:${bg};--text:${text}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.hero{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 24px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 8%,var(--bg)),var(--bg))}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:800;letter-spacing:-0.02em;max-width:18ch;margin-bottom:16px}
.hero p{font-size:clamp(1.05rem,2vw,1.3rem);max-width:52ch;opacity:.85;margin-bottom:32px}
.hero-logo img{max-height:96px;margin-bottom:24px;border-radius:12px}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:1.05rem}
.cta:hover{filter:brightness(1.1)}
.section{max-width:960px;margin:0 auto;padding:64px 24px}
.section h2{font-size:1.75rem;margin-bottom:16px}
.contacts{list-style:none;display:grid;gap:8px}
.contacts a{color:var(--accent)}
footer{text-align:center;padding:32px 24px;border-top:1px solid color-mix(in srgb,var(--text) 12%,transparent)}
.socials{display:flex;gap:16px;justify-content:center;margin-top:12px}
.socials a{color:var(--accent);text-decoration:none;font-weight:600}
@media(max-width:767px){.hero{min-height:60vh;padding:32px 16px}}`;
}

/**
 * TB-012 step 2 pilota: landing page statica da dati cliente (webAnswers
 * dal form intake + asset draft). Zero AI, zero dipendenze runtime.
 */
export function buildLandingWebsite(input: LandingDraftInput): Website {
  const name = input.businessName || 'Sito';
  const wa = input.webAnswers || {};
  const headline = pick(wa.headline, input.flyer?.content?.headline, name);
  const offer = pick(wa.offer, input.flyer?.content?.body, input.activity, '');
  const cta = pick(wa.cta, input.flyer?.content?.cta?.label, 'Contattaci');
  const tone = pick(wa.tone, '');
  const accent = input.flyer?.style?.accentColor || colorFromName(input.preferredColors || name);

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(name)}</title>
</head>
<body>
<header class="hero">
${heroImage(input.logoUrl)}
<h1>${esc(headline)}</h1>
${offer ? `<p>${esc(offer)}</p>` : ''}
<a class="cta" href="#contatti">${esc(cta)}</a>
</header>
${contactsHtml(input.contacts)}
${footerHtml(name, input.socials)}
<script>document.querySelector('.current-year').textContent=new Date().getFullYear()</script>
</body>
</html>`;

  return {
    documentType: 'website',
    id: `website_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: name,
    brief: {
      businessName: name,
      sector: '',
      description: offer,
      tone,
      target: '',
      pages: 'index',
      preferredColors: input.preferredColors || '',
      font: 'Inter',
      cta,
      sections: 'hero, contatti',
      features: '',
      address: String(input.contacts?.address ?? ''),
      phone: String(input.contacts?.phone ?? ''),
      email: String(input.contacts?.email ?? ''),
      contacts: '',
      socials: (input.socials || []).map((s) => ({ platform: s.platform || '', url: s.url || '' })),
      mapsUrl: '',
      notes: '',
    },
    logoUrl: input.logoUrl || null,
    images: [],
    html,
    css: landingCss(accent, tone),
    js: '',
    framework: 'vanilla',
    style: 'modern',
    pages: ['index'],
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Esporta la landing bozza come ZIP (riusa il pattern exportWebsiteZip). */
export async function exportLandingZip(input: LandingDraftInput | Website): Promise<{ fileName: string; assetCount: number }> {
  const site = 'documentType' in input ? input : buildLandingWebsite(input);
  return exportWebsiteZip(site);
}
