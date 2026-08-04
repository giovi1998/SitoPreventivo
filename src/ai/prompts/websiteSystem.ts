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
    parts.push(`Maps URL (link esterno, NON per embed): ${brief.mapsUrl}`);
    if (brief.contacts) {
      const address = sanitizeMapAddress(brief.contacts);
      parts.push(`⚠️ MAPPA OBBLIGATORIA — usa ESATTAMENTE questo iframe nella sezione contatti (NON costruirne un altro, NON copiare l'emoji):`);
      parts.push(`  <iframe src="https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed" width="100%" height="400" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`);
      parts.push(`  Il parametro q deve essere esattamente "${encodeURIComponent(address)}" (indirizzo senza emoji/icone + città).`);
    } else {
      parts.push('⚠️ Per l\'embed Google Maps usa l\'indirizzo reale come parametro q, non il codice goo.gl.');
    }
  }
  if (brief.notes) parts.push(`Note: ${brief.notes}`);
  if (briefContext) parts.push(`Contesto: ${briefContext}`);

  parts.push('\n---');
  parts.push('Genera SOLO la struttura HTML del sito web. Nessun CSS, nessun JavaScript.');
  parts.push('Usa classi semantiche (es. class="hero", class="nav", class="footer", class="section-inner").');
  parts.push('🚫 LOGO: NON generare MAI tag <img>, <svg> logo, <span class="brand-mark">, né testo logo placeholder.');
  parts.push('Il logo reale viene iniettato automaticamente DOPO la generazione nel .brand o .nav-inner.');
  parts.push('Nella <div class="brand"> metti SOLO il testo del nome attività.');
  parts.push('🚫 EMOJI NEL TESTO: NON usare emoji nel brand, nei titoli o nel testo visibile (es. 🍦 gelato). Usa solo testo pulito.');
  parts.push('\n⚠️ STRUTTURA NAV OBBLIGATORIA:');
  parts.push('- <header class="nav"> o <nav class="nav"> con <div class="nav-inner">');
  parts.push('- <div class="brand"> con il nome attività (il logo viene iniettato dopo)');
  parts.push('- <button class="menu-toggle">☰</button> DENTRO il nav (per hamburger mobile)');
  parts.push('- <ul class="nav-links"> con i link');
  parts.push('- Il bottone menu-toggle deve essere SEMPRE presente, anche se il sito è semplice.');
  parts.push('\n⚠️ QUALITÀ HTML:');
  parts.push('- Usa <section> con id per ogni sezione (es. <section id="chi-siamo">)');
  parts.push('- Aggiungi <meta name="description"> nel <head> con descrizione SEO');
  parts.push('- Aggiungi <link rel="canonical"> se pertinente');
  parts.push('- Usa tag semantici: <header>, <nav>, <main>, <section>, <footer>');
  parts.push('- Ogni sezione deve avere <div class="section-inner"> per contenuto centrato');
  parts.push('- Aggiungi classe .current-year nel footer per l\'anno automatico via JS');
  parts.push('- I link social devono avere target="_blank" rel="noopener"');
  if (brief.socials && brief.socials.length > 0) {
    const socialLines = brief.socials.filter(s => s.platform || s.url).map(s => `  - ${s.platform}: ${s.url}`);
    if (socialLines.length > 0) {
      parts.push('\n⚠️ SOCIAL OBBLIGATORI — includi TUTTI questi nel footer (sezione social):');
      parts.push(socialLines.join('\n'));
      parts.push('  Usa <a href="URL" target="_blank" rel="noopener"> con il nome della piattaforma come testo.');
      parts.push('  Se il valore è un @username (senza URL), costruisci il link col dominio della piattaforma.');
    }
  }
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

/** Rimuove emoji/icone dall'indirizzo per Google Maps (es. "📍 Via Dante 5/A" → "Via Dante 5/A"). */
function sanitizeMapAddress(contacts: string): string {
  const cleaned = contacts.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
  const partsList = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  return partsList.slice(0, 2).join(' ');
}

export function buildWebsiteCssPrompt(
  html: string,
  style: string,
  brief: { preferredColors?: string; font?: string },
): string {
  return `# Generazione CSS responsive premium per sito web

Ecco la struttura HTML completa del sito:
\`\`\`html
${html.slice(0, 5000)}
\`\`\`

Stile visivo richiesto: ${style}
${brief.preferredColors ? `Colori preferiti: ${brief.preferredColors}` : ''}
${brief.font ? `Font preferito (OBBLIGATORIO, massima priorità): ${brief.font}` : ''}

${brief.font ? `⚠️ FONT: usa "${brief.font}" come font principale (--font). NON importare altri font Google, NON sostituirlo con la firma dello stile. Lo stile cambia peso/forma/lettering, MAI il nome del font richiesto.` : ''}

Genera CSS COMPLETO per OGNI classe/id usata nell'HTML sopra. NON omettere classi.

OBBLIGATORIO:
- Variabili CSS custom :root { --primary, --secondary, --accent, --bg, --text, --font, --muted, --border, --radius, --shadow }
- Layout con CSS Grid o Flexbox (MAI float)
- Media query @media (max-width: 768px) per mobile (almeno 5 regole responsive)
- Media query @media (max-width: 480px) per small phone
- Hamburger menu: nascosto su desktop (display:none), visibile su mobile
- Transizioni fluide (transition: 0.3s ease)
- Focus states per accessibilità (:focus-visible con outline)
- Stili per .hero, .hero h1, .hero p, .btn, .section-inner, .footer, .nav, .nav-links, .menu-toggle
- Brand wrapper (logo + nome): display:flex, align-items:center, gap:12px. MAI column.
- Padding/margin coerenti (usa variabili --space-*)
- Font-size fluidi con clamp() dove appropriato
- Box-sizing: border-box su tutti gli elementi
- Scroll-behavior: smooth sull'html
- .nav.scrolled: box-shadow e background più opaco quando scroll > 50px
- .nav-open .nav-links: display flex su mobile (menu aperto)
- .btn: padding 12px 24px, border-radius 8px, font-weight 600, transition
- .btn:hover: translateY(-1px), box-shadow aumentato
- .section-inner: max-width 1100px, margin 0 auto, padding 2rem 1rem
- .hero: padding 4rem 1rem, text-align center, background gradient o colore solido
- .hero h1: font-size 2.5rem, margin-bottom 0.5rem, line-height 1.1
- .hero p: font-size 1.1rem, color var(--muted), max-width 600px, margin 0 auto 1.5rem
- .footer: padding 2rem 1rem, text-align center, border-top, color var(--muted)
- .current-year: display inline (per JS anno corrente)

QUALITÀ PREMIUM:
- Palette limitata: max 1 colore accent, saturazione < 80%
- Ombre: tinted al colore di sfondo (non pure black)
- Spaziatura coerente: usa multipli di 4px/8px
- Tipografia: font-size scalati (16px body, 14px small, 20px+ headings)
- Contrasto WCAG AA: testo su sfondo almeno 4.5:1
- Transizioni solo su transform e opacity (performance)
- Mobile-first: layout a 1 colonna sotto 768px

CARATTERE VISIVO PER STILE — applica le firme distintive di "${style}":
${styleVisualSignature(style)}
${brief.font ? `\n⚠️ NOTA FONT: la firma dello stile descrive peso/forma/lettering, MAI il nome del font. Se il brief richiede "${brief.font}", --font DEVE essere "${brief.font}".` : ''}

Il CSS deve essere COMPLETO, RESPONSIVE e PRONTO ALL'USO.
Rispondi SOLO con JSON: { "css": "..." }
IL CAMPO "css" NON DEVE MAI ESSERE VUOTO.`;
}

function styleVisualSignature(style: string): string {
  const signatures: Record<string, string> = {
    modern: `- Firma: pulito, spazi ariosi, forme morbide (radius 12-16px), gradiente sottile sul hero
- Micro-interazioni: hover lift sui card/btn, ombre soft tinted
- Tipografia: sans geometrica, headline bold con tracking tight`,
    minimal: `- Firma: riduzione assoluta, molto whitespace, 1 solo accent
- Niente decorazioni: solo tipografia, layout e colore
- Bordi sottili (1px), radius 0-4px, ombre quasi assenti
- Tipografia: sans neutra, grande scala tipografica`,
    corporate: `- Firma: professionale, fiducia, struttura a griglia rigida
- Colori sobri (blu navy/teal/grigio), accent singolo
- Card con bordi definiti, ombre leggere, header stabile
- Tipografia: sans classica (Roboto/Inter), headings semibold`,
    creative: `- Firma: audace, asimmetria controllata, forme geometriche
- Elementi decorativi: forme SVG, pattern, angoli tagliati
- Tipografia: display bold con accento corsivo/italic su una parola
- Colori vivaci ma bilanciati, gradienti mirati (mai AI-purple)`,
    brutalist: `- Firma: grezzo, monospace, bordi spessi (2-3px), shadow hard offset
- Niente radius, niente gradienti, niente ombre morbide
- Tipografia: mono o sans estremo, testo grande, UPPERCASE
- Colori: alto contrasto (nero su bianco + 1 neon accent)`,
    elegant: `- Firma: raffinato, serif display, molto whitespace, dettagli dorati
- Font serif (Playfair/Cormorant) per headline, sans per body
- Ombre leggere, border sottili, radius generoso su card
- Palette: neutri caldi o freddi + 1 accent metallico (oro/rame/argento)`,
    vintage: `- Firma: retrò, texture carta, bordi doppi, tinte sbiadite
- Font serif con letterpress, UPPERCASE su etichette
- Decorazioni: filigrane, pattern sottili, bordi ornamentali
- Palette: crema/avorio + accent terracotta/verde salvia/marrone`,
    tech: `- Firma: futuristico, glassmorphism, griglie, terminal hints
- backdrop-filter blur, bordi 1px trasparenti, glow sottile sull'accent
- Tipografia: mono per label/eyebrow, sans per body
- Palette: dark o light tech (blu elettrico/ciano accent su scuro)`,
    organic: `- Firma: naturale, forme fluide, texture organiche
- Border-radius asimmetrici (bordo blob), gradienti morbidi
- Tipografia: font con curve (sans umanista o serif dolce)
- Palette: verdi, terracotta, crema, legno`,
    playful: `- Firma: gioioso, colori vivaci, forme arrotondate (radius 20px+)
- Decorazioni: blob shapes, emoji-adjacent, sticker-style badge
- Tipografia: font arrotondato/grottesco, headline con spessore variabile
- Micro-animazioni: bounce/float sottili su elementi chiave`,
    luxury: `- Firma: premium, dark o light opulento, dettagli gold/chrome
- Spazi generosi, tipografia grande, tracking ampio su label
- Texture: gradienti metallici sottili, border 1px dorato
- Tipografia: serif display elegante + sans light per body`,
    editorial: `- Firma: magazine, griglia asimmetrica, numeri grandi, serif
- Layout: colonne editoriali, headline enorme, pull-quote
- Tipografia: serif per headline/body, mono per etichette
- Palette: monocromatico + 1 accent deciso`,
    dark: `- Firma: dark mode completo, contrasto alto, glow moderato
- Sfondo off-black (mai #000 puro), superficie elevate via overlay
- Accent luminoso singolo, testo off-white
- Tipografia: sans chiara, headline bold, mono per label`,
  };
  return signatures[style] ?? signatures.modern;
}

export function buildWebsiteJsPrompt(html: string): string {
  return `# Generazione JavaScript premium per sito web

Ecco la struttura HTML completa del sito:
\`\`\`html
${html.slice(0, 5000)}
\`\`\`

⚠️ DEVI GENERARE JAVASCRIPT FUNZIONANTE. NON RESTITUIRE MAI { "js": "" }.

Il JS deve funzionare con QUALSIASI struttura HTML. Usa querySelector generici con fallback.

Funzioni da includere OBBLIGATORIAMENTE (tutte):
1. **Smooth scroll** per link anchor: document.querySelectorAll('a[href^="#"]').forEach...
2. **Hamburger menu**: cerca .menu-toggle o <button> dentro <header>/<nav>. Se non c'è bottone, creane uno con JS e appendilo al nav. Toggle classe .nav-open sul nav.
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

QUALITÀ JS:
- Usa 'use strict' all'inizio
- Wrapper in IIFE o DOMContentLoaded per non inquinare global scope
- Variabili con const/let (mai var)
- Event listener con { passive: true } per scroll
- Performance: evita querySelectorAll ripetuti, cache i selettori
- Accessibility: aria-expanded sul toggle menu, role="navigation" sul nav
- Fallback: se un elemento non esiste, non crashare (optional chaining o if guard)

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
