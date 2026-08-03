export function buildWebsiteSystemPrompt(): string {
  return `Sei un web designer AI per Quickbrand. Generi siti web HTML5 completi, responsive, pronti per l'uso.

REGOLE FONDAMENTALI:
- Rispondi SOLO con un oggetto JSON contenente: html, css, js, pages[], heroPrompts[] (opzionale).
- html: HTML5 valido con <meta name="viewport">, tag semantici (<header>, <nav>, <main>, <section>, <footer>).
- css: CSS con variabili custom :root { --primary, --secondary, --accent, --bg, --text, --font }, CSS Grid/Flexbox, media query a 768px.
- js: Vanilla ES6+ per interazioni base (menu hamburger mobile, smooth scroll, form validation). Progressive enhancement: il sito funziona anche senza JS.
- pages: array di nomi pagina (es. ["index", "about", "contact"]). Se il brief richiede >1 pagina, genera link relativi tra pagine. Ogni pagina è autonoma (ha il suo CSS/JS completo). Se il brief è semplice, single-page con sezioni anchor.
- heroPrompts: array di prompt per generazione immagini hero via AI (opzionale, max 5). Usa solo se il brief richiede immagini fotografiche.

CONTENUTI:
- Genera contenuti placeholder realistici in italiano, coerenti col settore e descrizione del cliente. MAI "Lorem ipsum".
- Le immagini hero devono usare gradient fallback nel CSS: background: linear-gradient(...) come fallback prima di background-image.
- Icone e decorazioni: SVG inline con viewBox e currentColor (zero dipendenze esterne).
- CTA: usa la call-to-action principale fornita nel brief.

VINCOLI:
- NO dipendenze CDN esterne (salvo richiesta esplicita nel brief).
- NO commenti nel codice (tranne header con versione/data).
- NO chiamate API a server esterni.
- Il codice deve essere completo e funzionante se aperto in un browser.
- I link tra pagine devono essere relativi (href="about.html").
- Il CSS deve usare variabili CSS custom per colori primari/secondari (facile rebranding).`;
}

export function buildWebsiteGeneratePrompt(
  brief: {
    businessName: string;
    sector: string;
    description: string;
    tone: string;
    target: string;
    pages: string;
    preferredColors: string;
    font: string;
    cta: string;
    sections: string;
    features: string;
    contacts: string;
    socials: { platform: string; url: string }[];
    mapsUrl: string;
    notes: string;
  },
  style: string,
  briefContext?: string,
): string {
  const parts: string[] = ['# Richiesta generazione sito web\n'];

  parts.push('## Dati attività');
  parts.push(`- Nome: ${brief.businessName}`);
  if (brief.sector) parts.push(`- Settore: ${brief.sector}`);
  parts.push(`- Descrizione: ${brief.description}`);

  parts.push('\n## Stile e comunicazione');
  if (brief.tone) parts.push(`- Tono: ${brief.tone}`);
  if (brief.target) parts.push(`- Target: ${brief.target}`);
  parts.push(`- Stile visivo: ${style}`);
  if (brief.font) parts.push(`- Font preferito: ${brief.font}`);
  if (brief.preferredColors) parts.push(`- Colori preferiti: ${brief.preferredColors}`);

  parts.push('\n## Struttura');
  if (brief.pages) parts.push(`- Pagine richieste: ${brief.pages}`);
  if (brief.sections) parts.push(`- Sezioni desiderate: ${brief.sections}`);
  if (brief.cta) parts.push(`- Call-to-action principale: ${brief.cta}`);
  if (brief.features) parts.push(`- Feature speciali: ${brief.features}`);

  parts.push('\n## Contatti e social');
  if (brief.contacts) parts.push(`- Contatti: ${brief.contacts}`);
  if (brief.socials && brief.socials.length > 0) {
    const socialLines = brief.socials.filter(s => s.platform || s.url).map(s => `  - ${s.platform}: ${s.url}`);
    if (socialLines.length > 0) parts.push(`- Social:\n${socialLines.join('\n')}`);
  }
  if (brief.mapsUrl) parts.push(`- Google Maps: ${brief.mapsUrl}`);

  if (brief.notes) {
    parts.push('\n## Note extra');
    parts.push(brief.notes);
  }

  if (briefContext) {
    parts.push('\n## Contesto cliente');
    parts.push(briefContext);
  }

  parts.push('\nGenera un sito web HTML5 completo, responsive, con CSS e JavaScript.');
  parts.push('Rispondi SOLO con un oggetto JSON contenente: html, css, js, pages[], heroPrompts[].');
  return parts.join('\n');
}

// ─── 4 agenti separati ─────────────────────────────────────────

export function buildWebsiteHtmlPrompt(
  brief: {
    businessName: string;
    sector: string;
    description: string;
    tone: string;
    target: string;
    pages: string;
    preferredColors: string;
    font: string;
    cta: string;
    sections: string;
    features: string;
    contacts: string;
    socials: { platform: string; url: string }[];
    mapsUrl: string;
    notes: string;
  },
  style: string,
  briefContext?: string,
): string {
  const parts: string[] = ['# Generazione HTML sito web\n'];
  parts.push(`## Attività: ${brief.businessName}`);
  if (brief.sector) parts.push(`Settore: ${brief.sector}`);
  parts.push(`Descrizione: ${brief.description}`);
  if (brief.tone) parts.push(`Tono: ${brief.tone}`);
  if (brief.target) parts.push(`Target: ${brief.target}`);
  parts.push(`Stile: ${style}`);
  if (brief.preferredColors) parts.push(`Colori: ${brief.preferredColors}`);
  if (brief.font) parts.push(`Font: ${brief.font}`);
  if (brief.pages) parts.push(`Pagine: ${brief.pages}`);
  if (brief.sections) parts.push(`Sezioni: ${brief.sections}`);
  if (brief.cta) parts.push(`CTA: ${brief.cta}`);
  if (brief.features) parts.push(`Feature: ${brief.features}`);
  if (brief.contacts) parts.push(`Contatti: ${brief.contacts}`);
  if (brief.mapsUrl) parts.push(`Maps: ${brief.mapsUrl}`);
  if (brief.notes) parts.push(`Note: ${brief.notes}`);
  if (briefContext) parts.push(`Contesto: ${briefContext}`);

  parts.push('\n---');
  parts.push('Genera SOLO la struttura HTML del sito web. Nessun CSS, nessun JavaScript.');
  parts.push('Usa classi semantiche (es. class="hero", class="nav", class="footer", class="section-inner").');
  parts.push('Non generare tag <img> per il logo del brand. Non generare <span class="brand-mark">.');
  parts.push('Il logo viene gestito separatamente.');
  parts.push('Rispondi SOLO con JSON: { "html": "...", "pages": ["index"] }');
  return parts.join('\n');
}

export function buildWebsiteCssPrompt(
  html: string,
  style: string,
  brief: { preferredColors?: string; font?: string },
): string {
  return `# Generazione CSS per sito web

Ecco la struttura HTML del sito:
\`\`\`html
${html.slice(0, 3000)}
\`\`\`

Stile visivo richiesto: ${style}
${brief.preferredColors ? `Colori preferiti: ${brief.preferredColors}` : ''}
${brief.font ? `Font preferito: ${brief.font}` : ''}

Genera SOLO il CSS per stilizzare l'HTML sopra.
Usa variabili CSS custom :root { --primary, --secondary, --accent, --bg, --text, --font }.
CSS Grid / Flexbox per layout. Media query a 768px per mobile.
Il CSS deve coprire TUTTE le classi usate nell'HTML.
Rispondi SOLO con JSON: { "css": "..." }`;
}

export function buildWebsiteJsPrompt(html: string): string {
  return `# Generazione JavaScript per sito web

Ecco la struttura HTML del sito:
\`\`\`html
${html.slice(0, 3000)}
\`\`\`

Genera SOLO JavaScript vanilla ES6+ per interazioni:
- Menu hamburger mobile (usa classi .menu-toggle e .nav)
- Smooth scroll per link anchor (#)
- Form validation base se presente un form
- Eventuali interazioni richieste dalle classi nell'HTML

Progressive enhancement: il sito funziona anche senza JS.
Rispondi SOLO con JSON: { "js": "..." }`;
}

export function buildWebsiteVerifyPrompt(
  html: string,
  css: string,
  js: string,
): string {
  return `# Verifica coerenza sito web

HTML:
\`\`\`html
${html.slice(0, 2000)}
\`\`\`

CSS:
\`\`\`css
${css.slice(0, 2000)}
\`\`\`

JS:
\`\`\`js
${js.slice(0, 1000)}
\`\`\`

Controlla che HTML, CSS e JS siano coerenti:
1. Ogni classe CSS usata nell'HTML esiste nel CSS?
2. Ogni id usato nel JS esiste nell'HTML?
3. Ci sono errori evidenti (tag non chiusi, sintassi CSS errata)?
4. Il CSS copre tutte le sezioni dell'HTML?

Se trovi problemi, fornisci le correzioni.
Rispondi SOLO con JSON: { "issues": ["..."], "fixes": { "html"?: "...", "css"?: "...", "js"?: "..." } }`;
}
