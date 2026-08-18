/**
 * Element picker per il Website Builder: modalità "Seleziona elemento"
 * (toggle come devtools). L'utente attiva la modalità, clicca un elemento
 * nella preview iframe, e il contesto (HTML + CSS rules + computed style)
 * viene passato al refine AI mirato.
 *
 * Il picker opera sul contentDocument dell'iframe (sandbox allow-same-origin
 * lo permette). Le coordinate clientX/Y dell'evento sono già nel viewport
 * dell'iframe → nessun mapping necessario, anche a viewport mobile.
 */

export interface ElementContext {
  /** Dove vive l'elemento: html (index) o pagesHtml (pagina secondaria). */
  part: 'html' | 'pagesHtml';
  /** Nome pagina: 'index' per part html, nome pagina per pagesHtml. */
  page: string;
  /** Viewport della preview al momento della selezione (100% | 768px | 375px). */
  viewport: string;
  /** outerHTML dell'elemento selezionato. */
  html: string;
  /** Regole CSS del sito che matchano l'elemento (selettore + dichiarazioni). */
  cssRules: string[];
  /** Regole CSS di elementi simili (stesso tag, es. altri h2): riferimento
   *  per istruzioni tipo "metti lo stesso effetto di prima". */
  similarRules: string[];
  /** Proprietà computed chiave (color, font-size, background, ...). */
  computed: Record<string, string>;
}

const PICKER_STYLE_ID = 'website-picker-style';
const PICKER_HIGHLIGHT = 'website-picker-highlight';
const PICKER_SCOPE_CLASS = 'element-picker-scope';

const COMPUTED_PROPS = [
  'color', 'background-color', 'background-image', 'font-family', 'font-size',
  'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align',
  'text-transform', 'text-decoration', 'text-shadow', 'display', 'position',
  'width', 'height', 'padding', 'margin', 'border', 'border-radius', 'gap',
  'flex-direction', 'justify-content', 'align-items', 'opacity', 'box-shadow',
  'transform', 'transition', 'animation', 'z-index',
];

/**
 * Attiva la modalità picker su un documento (preview iframe) o su un
 * elemento container (DOM in-page: card/flyer/logo). Ritorna una funzione
 * per disattivarla (rimuove listener e stili). `onSelect` riceve l'elemento
 * cliccato; il click è consumato (preventDefault + stopPropagation).
 *
 * Con un container, i listener sono SCOPED: i click fuori dal container
 * (toolbar, bottoni, drag handles) NON vengono intercettati — altrimenti
 * il bottone 🎯 stesso non potrebbe spegnere il picker e il drag&drop
 * della preview morirebbe (click post-pointerup bloccato).
 */
export function enablePicker(target: Document | HTMLElement, onSelect: (el: Element) => void): () => void {
  // Cross-realm safety: il contentDocument di un iframe NON è instanceof
  // Document nel realm principale (Chrome) → il picker website moriva
  // trattando il Document come container (classList.add su Document).
  const isDoc = target.nodeType === 9;
  const root: Document = isDoc ? (target as Document) : (target.ownerDocument ?? document);
  const container = isDoc ? null : (target as HTMLElement);

  const style = root.createElement('style');
  style.id = PICKER_STYLE_ID;
  style.textContent = container
    ? `.${PICKER_SCOPE_CLASS}, .${PICKER_SCOPE_CLASS} * { cursor: crosshair !important; }`
    : `* { cursor: crosshair !important; }`;
  root.head.appendChild(style);
  if (container) container.classList.add(PICKER_SCOPE_CLASS);

  let highlighted: HTMLElement | null = null;
  let previousOutline = '';
  let previousOutlineOffset = '';

  const clearHighlight = () => {
    if (highlighted) {
      highlighted.style.outline = previousOutline;
      highlighted.style.outlineOffset = previousOutlineOffset;
      highlighted = null;
    }
  };

  const inScope = (e: Event): boolean => {
    if (!container) return true;
    const t = e.target as Node | null;
    return !!(t && container.contains(t));
  };

  const onMouseOver = (e: MouseEvent) => {
    if (!inScope(e)) return;
    const t = e.target as HTMLElement | null;
    if (!t || t === highlighted) return;
    clearHighlight();
    highlighted = t;
    previousOutline = t.style.outline;
    previousOutlineOffset = t.style.outlineOffset;
    t.style.outline = `2px solid #4f46e5`;
    t.style.outlineOffset = '1px';
  };

  const onMouseOut = (e: MouseEvent) => {
    if (e.target === highlighted) clearHighlight();
  };

  const onClick = (e: MouseEvent) => {
    if (!inScope(e)) return;
    e.preventDefault();
    e.stopPropagation();
    // elementFromPoint non esiste in jsdom: fallback al target del click
    // (equivalente nei browser reali per un click diretto).
    let el: Element | null = null;
    try {
      el = root.elementFromPoint ? root.elementFromPoint(e.clientX, e.clientY) : null;
    } catch {
      el = null;
    }
    if (!el) el = e.target as Element | null;
    if (el) {
      clearHighlight();
      onSelect(el);
    }
  };

  const scopeRoot: Document | HTMLElement = target;
  scopeRoot.addEventListener('mouseover', onMouseOver as EventListener, true);
  scopeRoot.addEventListener('mouseout', onMouseOut as EventListener, true);
  scopeRoot.addEventListener('click', onClick as EventListener, true);

  return () => {
    clearHighlight();
    scopeRoot.removeEventListener('mouseover', onMouseOver as EventListener, true);
    scopeRoot.removeEventListener('mouseout', onMouseOut as EventListener, true);
    scopeRoot.removeEventListener('click', onClick as EventListener, true);
    if (container) container.classList.remove(PICKER_SCOPE_CLASS);
    style.remove();
  };
}

/**
 * Estrae il contesto di un elemento per il refine mirato: outerHTML, regole
 * CSS del sito che lo matchano, e computed style chiave.
 */
export function extractElementContext(el: Element, css: string, page: string, viewport: string): ElementContext {
  const html = cleanPickerArtifacts(el);
  return {
    part: page === 'index' ? 'html' : 'pagesHtml',
    page,
    viewport,
    html,
    cssRules: matchingCssRules(el, css),
    similarRules: matchingSimilarRules(el, css),
    computed: computedStyle(el),
  };
}

/** outerHTML senza gli artefatti del picker (outline/outlineOffset inline):
 *  altrimenti il find dell'AI non esiste nel sorgente → edit skipped. */
function cleanPickerArtifacts(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  const strip = (node: Element) => {
    if (node.hasAttribute('style')) {
      const s = node.getAttribute('style') ?? '';
      const cleaned = s
        .replace(/outline-offset\s*:\s*[^;]+;?/gi, '')
        .replace(/outline\s*:\s*[^;]+;?/gi, '')
        .trim();
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    }
  };
  strip(clone);
  clone.querySelectorAll('*').forEach(strip);
  return clone.outerHTML;
}

/** Proprietà ereditabili: una regola su root/antenato che le setta spiega il computed dell'elemento. */
const INHERITED_PROPS = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'color', 'text-shadow',
  'word-spacing', 'white-space',
];

function hasInheritedOrVars(body: string): boolean {
  return INHERITED_PROPS.some((p) => body.includes(p)) || body.includes('--');
}

/** Regole CSS (selettore + dichiarazioni) che matchano l'elemento. Include
 *  regole su :root/antenati che settano proprietà ereditabili o variabili
 *  custom (es. `--font`), altrimenti il computed mostra il valore risolto
 *  ma l'AI non vede la causa. */
export function matchingCssRules(el: Element, css: string): string[] {
  const rules: string[] = [];
  const ancestors: Element[] = [];
  let p = el.parentElement;
  while (p) {
    ancestors.push(p);
    p = p.parentElement;
  }
  const root = el.ownerDocument?.documentElement ?? null;
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selectors = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const body = m[2].trim();
    if (!body) continue;
    for (const raw of selectors) {
      let matched = false;
      if (raw === ':root') {
        matched = hasInheritedOrVars(body);
      } else {
        const clean = stripPseudo(raw);
        if (!clean) continue;
        try {
          if (el.matches(clean)) {
            matched = true;
          } else if (root && root.matches(clean)) {
            matched = hasInheritedOrVars(body);
          } else {
            for (const a of ancestors) {
              if (a.matches(clean)) {
                matched = hasInheritedOrVars(body);
                break;
              }
            }
          }
        } catch {
          // selettore non supportato da matches() (es. :has) → skip
        }
      }
      if (matched) {
        // m[0] = blocco sorgente esatto (whitespace originale). Ricostruire
        // `${raw} { ${body} }` collassa il whitespace → l'AI copia dal prompt
        // un find che non esiste nel sorgente multi-riga → edit skipped.
        // trim() rimuove solo il padding esterno, preserva le righe interne.
        rules.push(m[0].trim());
        break;
      }
    }
  }
  return rules;
}

/** Regole CSS di elementi simili (stesso tag, es. altri h2) che NON toccano
 *  l'elemento selezionato. Riferimento per istruzioni tipo "metti lo stesso
 *  effetto di prima": l'AI vede come sono stilizzati gli altri elementi. */
export function matchingSimilarRules(el: Element, css: string): string[] {
  const tag = el.tagName.toLowerCase();
  const rules: string[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selectors = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const body = m[2].trim();
    if (!body) continue;
    for (const raw of selectors) {
      const clean = stripPseudo(raw);
      if (!clean || !clean.includes(tag)) continue;
      try {
        if (el.matches(clean)) continue; // già in cssRules
      } catch {
        continue;
      }
      rules.push(m[0].trim());
      break;
    }
  }
  return rules;
}

/** Rimuove pseudo-classi/elementi (anche funzionali) da un selettore per el.matches(). */
export function stripPseudo(selector: string): string {
  return selector
    .replace(/::?[\w-]+(\([^)]*\))?/g, '')
    .trim();
}

function computedStyle(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  // Cross-realm safety: l'elemento può vivere nel document di un iframe
  // (preview website) — window.getComputedStyle lancia in quel caso.
  const doc = el.ownerDocument ?? document;
  const win = doc.defaultView;
  let cs: CSSStyleDeclaration | null = null;
  try {
    cs = win ? win.getComputedStyle(el) : null;
  } catch {
    cs = null;
  }
  if (!cs) return out;
  for (const prop of COMPUTED_PROPS) {
    const value = cs.getPropertyValue(prop);
    if (value) out[prop] = value;
  }
  // Variabili custom (--font, --primary, ...): il computed risolve i valori
  // (es. font-family → Palatino fallback) ma nasconde la causa. L'AI deve
  // vedere la variabile per capire perché il font è sbagliato.
  for (let i = 0; i < cs.length; i++) {
    const prop = cs.item(i);
    if (prop.startsWith('--')) {
      const value = cs.getPropertyValue(prop);
      if (value) out[prop] = value;
    }
  }
  return out;
}

/**
 * Verifica post-refine: l'elemento selezionato esiste ancora nel sorgente?
 * Confronto normalizzato (whitespace collassato) per tollerare differenze di
 * formattazione, ma rilevare modifiche di contenuto/attributi.
 */
export function findElementInSource(source: string, outerHtml: string): boolean {
  if (!source || !outerHtml) return false;
  return normalize(source).includes(normalize(outerHtml));
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}
