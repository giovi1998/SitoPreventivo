/**
 * Riparazione strutturale deterministica del sito (client-side, zero AI):
 * - CSS: estrae regole annidate dentro altre regole (il browser le ignora),
 *   bilancia le parentesi residue.
 * - HTML: rimuove tag di chiusura orfani (</tag> senza apertura) che
 *   "mangiano" il markup successivo.
 *
 * Best-effort: se il danno è troppo complesso, analyzeSiteCode lo segnala
 * ancora e il flusso ripiega sul repair AI.
 */

const VOID_TAGS = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr', 'col', 'embed', 'track', 'area', 'base']);

/** Trova l'indice della } che chiude la { a `openIdx`, gestendo stringhe e commenti. */
function findClosingBrace(s: string, openIdx: number): number {
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  let inComment = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inComment) {
      if (c === '*' && s[i + 1] === '/') { inComment = false; i++; }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) inString = false;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') { inComment = true; i++; continue; }
    if (c === '"' || c === "'") { inString = true; quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Estrae le regole annidate dentro regole normali (non @-rule) e bilancia le parentesi. */
export function repairCssStructure(css: string): string {
  if (!css) return css;
  let out = css;
  const extracted: string[] = [];
  let i = 0;
  const stack: Array<{ isAt: boolean }> = [];
  let inString = false;
  let quote = '';
  let escaped = false;
  let inComment = false;
  let selectorStart = -1;
  while (i < out.length) {
    const c = out[i];
    if (inComment) {
      if (c === '*' && out[i + 1] === '/') { inComment = false; i++; }
      i++;
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) inString = false;
      i++;
      continue;
    }
    if (c === '/' && out[i + 1] === '*') { inComment = true; i += 2; continue; }
    if (c === '"' || c === "'") { inString = true; quote = c; i++; continue; }
    if (c === '{') {
      const selector = out.slice(selectorStart, i).trim();
      const isAt = selector.startsWith('@');
      const parent = stack[stack.length - 1];
      if (parent && !parent.isAt && !isAt) {
        const close = findClosingBrace(out, i);
        if (close !== -1) {
          const block = out.slice(selectorStart, close + 1);
          extracted.push(block);
          out = out.slice(0, selectorStart) + out.slice(close + 1);
          i = selectorStart;
          stack.length = 0;
          selectorStart = -1;
          continue;
        }
      }
      stack.push({ isAt });
      selectorStart = -1;
      i++;
      continue;
    }
    if (c === '}') {
      stack.pop();
      selectorStart = -1;
      i++;
      continue;
    }
    if (selectorStart === -1 && !/[\s;]/.test(c)) selectorStart = i;
    i++;
  }
  if (extracted.length > 0) out = `${out}\n\n${extracted.join('\n')}`;

  // Bilancia parentesi residue: { extra → chiudi; } extra → rimuovi dalla fine.
  let depth = 0;
  inString = false;
  escaped = false;
  inComment = false;
  for (let j = 0; j < out.length; j++) {
    const c = out[j];
    if (inComment) {
      if (c === '*' && out[j + 1] === '/') { inComment = false; j++; }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"' || c === "'") inString = false;
      continue;
    }
    if (c === '/' && out[j + 1] === '*') { inComment = true; j++; continue; }
    if (c === '"' || c === "'") { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  if (depth > 0) out += '\n' + '}'.repeat(depth);
  else if (depth < 0) {
    let extra = -depth;
    let j = out.length - 1;
    while (extra > 0 && j >= 0) {
      if (out[j] === '}') extra--;
      j--;
    }
    out = out.slice(0, j + 1);
  }
  return out;
}

/** Rimuove i tag di chiusura orfani (</tag> senza apertura corrispondente). */
export function repairHtmlStructure(html: string): string {
  if (!html) return html;
  const stack: string[] = [];
  const removals: Array<{ start: number; end: number }> = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^>]*)?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    if (full.startsWith('</')) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) {
        removals.push({ start: m.index, end: m.index + full.length });
      } else {
        stack.splice(idx);
      }
    } else if (!VOID_TAGS.has(tag) && !full.endsWith('/>')) {
      stack.push(tag);
    }
  }
  if (removals.length === 0) return html;
  let out = html;
  for (let k = removals.length - 1; k >= 0; k--) {
    const r = removals[k];
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return out;
}
