/**
 * Analisi deterministica del sito generato, eseguita CLIENT-SIDE senza AI:
 * verifica struttura HTML (tag bilanciati), CSS (parentesi bilanciate),
 * pseudo-elementi con content non vuoto, immagini senza alt, SVG non
 * richiesti, emoji nel testo visibile. È il tool `analyze_site` che
 * DeepSeek/Ollama possono invocare durante il Verify (il modello non deve
 * MAI fidarsi di codice troncato nei prompt: se il codice è intero ma le
 * parentesi non tornano, il problema è reale).
 */
export interface SiteAnalysisResult {
  ok: boolean;
  issues: string[];
}

export interface AnalyzeSiteArgs {
  /** Indice nel codice da controllare (0 = html, 1 = css, 2 = js). */
  part: 0 | 1 | 2 | 'html' | 'css' | 'js';
}

const MAX_ISSUES = 8;

export function analyzeSiteCode(code: string, part: 'html' | 'css' | 'js'): SiteAnalysisResult {
  const issues: string[] = [];
  if (!code || code.trim().length === 0) {
    issues.push(`${part.toUpperCase()} è vuoto.`);
    return { ok: false, issues: issues.slice(0, MAX_ISSUES) };
  }

  if (part === 'html') {
    analyzeHtml(code, issues);
  } else if (part === 'css') {
    analyzeCss(code, issues);
  } else {
    analyzeJs(code, issues);
  }

  return { ok: issues.length === 0, issues: issues.slice(0, MAX_ISSUES) };
}

function analyzeHtml(html: string, issues: string[]): void {
  // Tag bilanciati: stack su tag semplici (ignora void e self-closing).
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const stack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const raw = m[0];
    const name = m[1].toLowerCase();
    if (raw.startsWith('</')) {
      const open = stack.pop();
      if (open !== name) {
        issues.push(`Tag non bilanciato: chiusura </${name}> senza apertura <${name}> (trovato ${open ? `</${open}>` : 'fine documento'}).`);
        return;
      }
    } else if (!raw.endsWith('/>') && !voidTags.has(name)) {
      stack.push(name);
    }
  }
  if (stack.length > 0) {
    issues.push(`Tag non chiusi: <${stack[stack.length - 1]}> aperto ma mai chiuso.`);
  }
  // Pseudo-elementi con content non vuoto (regola stile: content: "" obbligatorio).
  const pseudoRe = /::?(before|after)[^{]*\{[^}]*\}/gi;
  let p: RegExpExecArray | null;
  while ((p = pseudoRe.exec(html)) !== null) {
    const block = p[0];
    const contentMatch = block.match(/content\s*:\s*(['"])(.*?)\1/i);
    if (contentMatch && contentMatch[2].trim().length > 0) {
      issues.push(`::${p[1]} con content non vuoto (${JSON.stringify(contentMatch[2].trim().slice(0, 20))}): vietato, usare content: "".`);
    }
  }

  // Img senza alt.
  const imgRe = /<img\b[^>]*>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null) {
    if (!/\balt\s*=/i.test(im[0])) {
      issues.push(`<img> senza attributo alt.`);
    }
  }

  // Iframe senza title.
  const iframeRe = /<iframe\b[^>]*>/gi;
  let ifr: RegExpExecArray | null;
  while ((ifr = iframeRe.exec(html)) !== null) {
    if (!/\btitle\s*=/i.test(ifr[0])) {
      issues.push(`<iframe> senza attributo title.`);
    }
  }

  // Emoji nel testo visibile (titoli/paragrafi/bottoni).
  const textBlocks = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
  if (/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(textBlocks)) {
    issues.push(`Emoji trovate nel testo visibile: rimuoverle (solo testo pulito).`);
  }
}

function analyzeCss(css: string, issues: string[]): void {
  // Parentesi bilanciate: se no, il CSS è troncato o rotto.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"' || c === "'") inString = false;
      continue;
    }
    if (c === '"' || c === "'") inString = true;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  if (depth > 0) issues.push(`CSS ha ${depth} parentesi { non chiuse: regole troncate o sintassi rotta.`);
  if (depth < 0) issues.push(`CSS ha parentesi } chiuse senza apertura: sintassi rotta.`);
  if (depth === 0 && !css.trim().endsWith('}')) {
    issues.push(`CSS termina in modo sospetto (ultimo carattere non è "}"): possibile troncamento.`);
  }

  // Pseudo-elementi con content non vuoto.
  const pseudoRe = /::?(before|after)[^{]*\{[^}]*\}/gi;
  let p: RegExpExecArray | null;
  while ((p = pseudoRe.exec(css)) !== null) {
    const block = p[0];
    const contentMatch = block.match(/content\s*:\s*(['"])(.*?)\1/i);
    if (contentMatch && contentMatch[2].trim().length > 0) {
      issues.push(`::${p[1]} con content non vuoto (${JSON.stringify(contentMatch[2].trim().slice(0, 20))}): vietato, usare content: "".`);
    }
  }
}

function analyzeJs(js: string, issues: string[]): void {
  // Bilanciamento parentesi/stringhe: un troncamento rompe sempre il JS.
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < js.length; i++) {
    const c = js[i];
    const next = js[i + 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inString || inTemplate) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (inTemplate) {
        if (c === '`') inTemplate = false;
        else if (c === '${') { brace++; }
      } else if (c === quote) inString = false;
      continue;
    }
    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      inString = c !== '`';
      inTemplate = c === '`';
      quote = c;
      continue;
    }
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '{') brace++;
    else if (c === '}') brace--;
  }
  if (inString || inTemplate) issues.push(`JS ha una stringa non chiusa: codice troncato o sintassi rotta.`);
  if (paren !== 0) issues.push(`JS ha ${Math.abs(paren)} parentesi ${paren > 0 ? 'non chiuse' : 'chiuse senza apertura'}: codice troncato o sintassi rotta.`);
  if (bracket !== 0) issues.push(`JS ha ${Math.abs(bracket)} parentesi quadre ${bracket > 0 ? 'non chiuse' : 'chiuse senza apertura'}: codice troncato o sintassi rotta.`);
  if (brace !== 0) issues.push(`JS ha ${Math.abs(brace)} parentesi graffe ${brace > 0 ? 'non chiuse' : 'chiuse senza apertura'}: codice troncato o sintassi rotta.`);
}
