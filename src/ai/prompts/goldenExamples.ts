// t20: esempi ideali per few-shot per editor.
// L'utente cura gli esempi dopo il commit iniziale — placeholder validi ma minimali.
// Ogni esempio è un JSON completo come atteso in modalità MODIFICA.

export const GOLDEN_CARD_EXAMPLE = `## Esempio ideale
Input utente: "rendi premium la card di Giovanni"
Output JSON atteso (estratto):
{
  "front": { "name": "Giovanni Cidu", "title": "Full-Stack Developer", "company": "Quickbrand", "layout": "split", "useGrid": true },
  "back": { "phone": "+39 012 345 6789", "email": "mario.rossi@example.com", "website": "https://giovannicidu.vercel.app", "address": "Cagliari, Italia", "services": ["Sviluppo Web", "UI Design", "AI Engineering"] },
  "style": { "bgColor": "#FFFFFF", "textColor": "#1A1A2A", "accentColor": "#1E3A5F", "fontFamily": "Inter", "borderStyle": "accent-strip-left" },
  "grid": { "cols": 4, "rows": 4, "elements": { "photo": { "x": 0, "y": 0, "w": 1, "h": 4 }, "name": { "x": 1, "y": 0, "w": 3, "h": 1, "placement": { "scale": 1.2 } }, "title": { "x": 1, "y": 1, "w": 3, "h": 1 }, "company": { "x": 1, "y": 2, "w": 3, "h": 1, "placement": { "scale": 0.85 } } } },
  "decorations": { "pattern": "blob-corner", "opacity": 0.2, "palette": { "primary": "#1E3A5F", "secondary": "#E11D48", "accent": null } }
}`;

export const GOLDEN_FLYER_EXAMPLE = `## Esempio ideale
Input: brief "Sagra del Paese 15 Agosto, cibo tipico e musica dal vivo" tono formale A5 classic
Output JSON:
{
  "headline": "Sagra del Paese",
  "subheadline": "15 Agosto · Ingresso Libero",
  "body": "Cibo tipico, musica dal vivo e attività per famiglie.\\nTi aspettiamo in piazza dalle 19:00.",
  "cta": { "label": "Prenota Ora" }
}`;

export const GOLDEN_LOGO_EXAMPLE = `## Esempio ideale
Input: "pasticceria elegante"
Output JSON:
{
  "concepts": [
    { "primaryText": "DolceVita", "tagline": "Pasticceria Artigianale", "iconType": "lucide", "iconGlyph": "cake", "primaryColor": "#8B0000", "secondaryColor": "#1A1A1A", "layout": "stacked", "imagePrompt": "elegant pastry logo, minimal, warm cream background, serif typography" },
    { "primaryText": "DolceVita", "tagline": "Dal 1985", "iconType": "shape", "iconShape": "circle", "primaryColor": "#1E3A5F", "secondaryColor": "#C9A86A", "layout": "horizontal", "imagePrompt": "premium bakery emblem, circular badge, navy and gold" },
    { "primaryText": "DolceVita", "tagline": "", "iconType": "monogram", "iconGlyph": "DV", "primaryColor": "#01696F", "secondaryColor": "#1A1A2E", "layout": "vertical", "imagePrompt": "monogram DV, teal and charcoal, modern minimal" }
  ],
  "selected": 0
}`;

export const GOLDEN_SOCIAL_EXAMPLE = `## Esempio ideale
Input: card "Giovanni, Full-Stack Developer" tono professionale
Output JSON:
{
  "posts": [
    { "platform": "linkedin", "caption": "Costruisco prodotti web veloci e accessibili. Stack: React, Node, AI. Disponibile per consulenze.", "hashtags": ["#webdev", "#react", "#ai"], "tone": "professional" },
    { "platform": "instagram", "caption": "Dal brief al prodotto in giorni, non mesi. Swipe per vedere il processo.", "hashtags": ["#buildinpublic", "#design"], "tone": "casual" },
    { "platform": "facebook", "caption": "Hai un'idea? La trasformo in prodotto. Scrivimi per un preventivo veloce.", "hashtags": ["#freelance", "#startup"], "tone": "promotional" }
  ]
}`;

export const GOLDEN_WEBSITE_EXAMPLE = `## Esempio ideale
Input: Osteria Thai, tono caldo, Cagliari, Via Roma 1
Output JSON (estratto):
{
  "html": "<header class=\\"nav\\"><div class=\\"nav-inner\\"><div class=\\"brand\\">Osteria Thai</div><button class=\\"menu-toggle\\" aria-label=\\"Apri menu\\"></button><ul class=\\"nav-links\\"><li><a href=\\"index.html\\">Home</a></li></ul></div></header><section id=\\"hero\\" class=\\"hero\\"><h1>Autentica cucina thai a Cagliari</h1><p>Tradizione e sapori europei in un angolo di Sardegna.</p><a class=\\"btn\\" href=\\"#contatti\\">Prenota un tavolo</a></section>",
  "css": ":root{--primary:#D94625;--bg:#FFFBEB} .hero{padding:4rem 1rem;text-align:center} .btn{padding:12px 24px;border-radius:8px}",
  "js": "document.querySelector('.menu-toggle')?.addEventListener('click',()=>document.querySelector('.nav')?.classList.toggle('nav-open'))",
  "pages": ["index"]
}`;

export const GOLDEN_EXAMPLES: Record<string, string> = {
  'card-system': GOLDEN_CARD_EXAMPLE,
  'flyer-system': GOLDEN_FLYER_EXAMPLE,
  'logo-system': GOLDEN_LOGO_EXAMPLE,
  'social-system': GOLDEN_SOCIAL_EXAMPLE,
  'website-system': GOLDEN_WEBSITE_EXAMPLE,
};
