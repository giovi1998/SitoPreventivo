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
  if (brief.mapsUrl) {
    const embedUrl = brief.mapsUrl
      .replace(/^https:\/\/maps\.app\.goo\.gl\//, 'https://maps.google.com/maps?q=')
      .replace(/^https:\/\/www\.google\.com\/maps\//, 'https://www.google.com/maps/embed/v1/place?key=&q=');
    parts.push(`Maps: ${embedUrl}`);
  }
  if (brief.notes) parts.push(`Note: ${brief.notes}`);
  if (briefContext) parts.push(`Contesto: ${briefContext}`);

  parts.push('\n---');
  parts.push('Genera SOLO la struttura HTML del sito web. Nessun CSS, nessun JavaScript.');
  parts.push('Usa classi semantiche (es. class="hero", class="nav", class="footer", class="section-inner").');
  parts.push('Non generare tag <img> per il logo del brand. Non generare <span class="brand-mark">.');
  parts.push('Il logo viene gestito separatamente.');
  parts.push('\n⚠️ STRUTTURA NAV OBBLIGATORIA:');
  parts.push('- <header class="nav"> o <nav class="nav">');
  parts.push('- <button class="menu-toggle">☰</button> DENTRO il nav (per hamburger mobile)');
  parts.push('- <ul class="nav-links"> con i link');
  parts.push('- Il bottone menu-toggle deve essere SEMPRE presente, anche se il sito è semplice.');
  if (brief.sections) {
    parts.push(`\n⚠️ DEVI generare TUTTE le sezioni richieste: ${brief.sections}.`);
    parts.push('Ogni sezione deve essere un <section> con id corrispondente (es. <section id="chi-siamo">).');
  }
  if (brief.cta) {
    parts.push(`\nCall-to-action principale: "${brief.cta}". Includi un bottone/pulsante con questa CTA nella sezione hero.`);
  }
  if (brief.contacts) {
    parts.push(`\nContatti: ${brief.contacts}. Includi nella sezione contatti o nel footer.`);
  }
  parts.push('\nRispondi SOLO con JSON: { "html": "...", "pages": ["index"] }');
  return parts.join('\n');
}

export function buildWebsiteCssPrompt(
  html: string,
  style: string,
  brief: { preferredColors?: string; font?: string },
): string {
  return `# Generazione CSS responsive per sito web

Ecco la struttura HTML completa del sito:
\`\`\`html
${html.slice(0, 5000)}
\`\`\`

Stile visivo richiesto: ${style}
${brief.preferredColors ? `Colori preferiti: ${brief.preferredColors}` : ''}
${brief.font ? `Font preferito: ${brief.font}` : ''}

Genera CSS COMPLETO per OGNI classe/id usata nell'HTML sopra. NON omettere classi.

OBBLIGATORIO:
- Variabili CSS custom :root { --primary, --secondary, --accent, --bg, --text, --font }
- Layout con CSS Grid o Flexbox (MAI float)
- Media query @media (max-width: 768px) per mobile (almeno 5 regole responsive)
- Media query @media (max-width: 480px) per small phone
- Hamburger menu: nascosto su desktop (display:none), visibile su mobile
- Transizioni fluide (transition: 0.3s)
- Focus states per accessibilità (:focus-visible)
- Stili per .hero, .hero h1, .hero p, .btn, .section-inner, .footer, .nav, .nav-links
- Brand wrapper (logo + nome): display:flex, align-items:center, gap:12px. MAI column.
- Padding/margin coerenti (usa variabili --space-*)
- Font-size fluidi con clamp() dove appropriato
- Box-sizing: border-box su tutti gli elementi
- Scroll-behavior: smooth sull'html

Il CSS deve essere COMPLETO, RESPONSIVE e PRONTO ALL'USO.
Rispondi SOLO con JSON: { "css": "..." }
IL CAMPO "css" NON DEVE MAI ESSERE VUOTO.`;
}

export function buildWebsiteJsPrompt(html: string): string {
  return `# Generazione JavaScript per sito web

Ecco la struttura HTML completa del sito:
\`\`\`html
${html.slice(0, 5000)}
\`\`\`

⚠️ DEVI GENERARE JAVASCRIPT FUNZIONANTE. NON RESTITUIRE MAI { "js": "" }.

Il JS deve funzionare con QUALSIASI struttura HTML. Usa querySelector generici.

Funzioni da includere OBBLIGATORIAMENTE (tutte):
1. **Smooth scroll** per link anchor: document.querySelectorAll('a[href^="#"]').forEach...
2. **Hamburger menu**: cerca .menu-toggle o <button> dentro <header>/<nav>. Se non c'è bottone, creane uno con JS e appendilo al nav. Toggle classe .nav-open o .menu-open sul nav.
3. **Header scroll**: window.addEventListener('scroll', ...) aggiunge classe .scrolled a nav/header dopo 50px.
4. **Anno corrente**: document.querySelector('.current-year') e setta textContent.
5. **Intersection Observer**: new IntersectionObserver(...) per fade-in sulle section.
6. **Click fuori**: document.addEventListener('click', ...) chiude menu se click fuori dal nav.
7. **Lazy load**: se ci sono <img>, carica con IntersectionObserver.
8. **Form**: se c'è <form>, preventDefault + console.log.

ESEMPIO di output minimo (DEVI produrre almeno questo):
\`\`\`js
// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});
// Hamburger menu
const toggle = document.querySelector('.menu-toggle') || document.querySelector('header button') || document.querySelector('nav button');
const nav = document.querySelector('.nav') || document.querySelector('nav') || document.querySelector('header');
if (toggle && nav) {
  toggle.addEventListener('click', () => nav.classList.toggle('nav-open'));
  document.addEventListener('click', e => {
    if (!nav.contains(e.target)) nav.classList.remove('nav-open');
  });
}
// Header scroll effect
window.addEventListener('scroll', () => {
  const header = document.querySelector('.nav') || document.querySelector('header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 50);
});
// Anno corrente
const yearEl = document.querySelector('.current-year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());
// Intersection Observer per fade-in
document.querySelectorAll('section').forEach(s => {
  s.style.opacity = '0';
  s.style.transition = 'opacity 0.6s ease';
});
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.style.opacity = '1'; });
}, { threshold: 0.1 });
document.querySelectorAll('section').forEach(s => observer.observe(s));
\`\`\`

Rispondi SOLO con JSON: { "js": "..." }
IL CAMPO "js" DEVE CONTENERE ALMENO 30 RIGHE DI JAVASCRIPT. NON PUÒ ESSERE VUOTO.`;
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
5. Il JS ha funzioni che referenziano elementi che non esistono nell'HTML?

Se trovi problemi, fornisci le correzioni.
Se non ci sono problemi, rispondi con issues vuoto.
Rispondi SOLO con JSON: { "issues": ["..."], "fixes": { "html"?: "...", "css"?: "...", "js"?: "..." } }`;
}
