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
