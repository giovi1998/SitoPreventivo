import { describe, it, expect } from 'vitest';
import { enablePicker, extractElementContext, matchingCssRules, matchingSimilarRules, stripPseudo, findElementInSource } from '../elementPicker';

describe('elementPicker', () => {
  describe('enablePicker scoped (container)', () => {
    it('intercetta click DENTRO il container, ignora quelli fuori', () => {
      const container = document.createElement('div');
      const inside = document.createElement('button');
      inside.textContent = 'dentro';
      container.appendChild(inside);
      const outside = document.createElement('button');
      outside.textContent = 'fuori';
      document.body.appendChild(container);
      document.body.appendChild(outside);

      const picked: Element[] = [];
      const disable = enablePicker(container, (el) => picked.push(el));

      // Click dentro il container → selezionato, preventDefault applicato.
      const evtIn = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
      inside.dispatchEvent(evtIn);
      expect(picked.length).toBe(1);

      // Click fuori dal container → NON intercettato (drag&drop/toolbar ok).
      const evtOut = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
      outside.dispatchEvent(evtOut);
      expect(picked.length).toBe(1);

      disable();
      document.body.removeChild(container);
      document.body.removeChild(outside);
    });

    it('rimuove la classe scope e lo stile al disable', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const disable = enablePicker(container, () => {});
      expect(container.classList.contains('element-picker-scope')).toBe(true);
      expect(document.getElementById('website-picker-style')).not.toBeNull();
      disable();
      expect(container.classList.contains('element-picker-scope')).toBe(false);
      expect(document.getElementById('website-picker-style')).toBeNull();
      document.body.removeChild(container);
    });
  });

  describe('matchingCssRules', () => {
    it('trova regole che matchano l\'elemento', () => {
      const el = document.createElement('button');
      el.className = 'menu-toggle';
      const css = '.menu-toggle { display: none; } .hero { color: red; } .menu-toggle:hover { color: blue; }';
      const rules = matchingCssRules(el, css);
      expect(rules).toContain('.menu-toggle { display: none; }');
      expect(rules).toContain('.menu-toggle:hover { color: blue; }');
      expect(rules.some((r) => r.includes('.hero'))).toBe(false);
    });

    it('pseudo-classi funzionali strippate → regola matchabile', () => {
      const el = document.createElement('div');
      el.className = 'card';
      const css = '.card:has(img) { padding: 4px; } .card { margin: 0; }';
      const rules = matchingCssRules(el, css);
      expect(rules).toContain('.card { margin: 0; }');
      expect(rules).toContain('.card:has(img) { padding: 4px; }');
    });

    it('regole vuote ignorate', () => {
      const el = document.createElement('div');
      el.className = 'x';
      expect(matchingCssRules(el, '.x { }')).toEqual([]);
    });

    it('include :root con variabili custom (es. --font)', () => {
      const el = document.createElement('button');
      el.className = 'menu-toggle';
      const css = ':root { --font: "Playful"; } .menu-toggle { display: none; }';
      const rules = matchingCssRules(el, css);
      expect(rules).toContain(':root { --font: "Playful"; }');
    });

    it('include regole su antenati con proprietà ereditabili', () => {
      const parent = document.createElement('header');
      parent.className = 'site-header';
      const el = document.createElement('button');
      el.className = 'menu-toggle';
      parent.appendChild(el);
      document.body.appendChild(parent);
      const css = '.site-header { font-family: "Playful"; } .menu-toggle { display: none; }';
      const rules = matchingCssRules(el, css);
      expect(rules).toContain('.site-header { font-family: "Playful"; }');
      document.body.removeChild(parent);
    });

    it('esclude regole su antenati con sole proprietà non ereditabili', () => {
      const parent = document.createElement('header');
      parent.className = 'site-header';
      const el = document.createElement('button');
      el.className = 'menu-toggle';
      parent.appendChild(el);
      document.body.appendChild(parent);
      const css = '.site-header { display: flex; } .menu-toggle { display: none; }';
      const rules = matchingCssRules(el, css);
      expect(rules.some((r) => r.includes('.site-header'))).toBe(false);
      document.body.removeChild(parent);
    });
  });

  describe('matchingSimilarRules', () => {
    it('trova regole di elementi simili (stesso tag) che non toccano l\'elemento', () => {
      const el = document.createElement('h2');
      el.className = 'contatti-title';
      const css = '.contatti-title { color: var(--text); } .chi-siamo h2 { background: linear-gradient(135deg, var(--primary), var(--accent)); } .hero { color: red; }';
      const similar = matchingSimilarRules(el, css);
      expect(similar).toContain('.chi-siamo h2 { background: linear-gradient(135deg, var(--primary), var(--accent)); }');
      expect(similar.some((r) => r.includes('.contatti-title'))).toBe(false);
      expect(similar.some((r) => r.includes('.hero'))).toBe(false);
    });

    it('esclude regole che toccano già l\'elemento', () => {
      const el = document.createElement('h2');
      el.className = 'contatti-title';
      const css = '.contatti-title { color: var(--text); } .chi-siamo h2 { color: red; }';
      const similar = matchingSimilarRules(el, css);
      expect(similar).toContain('.chi-siamo h2 { color: red; }');
      expect(similar.some((r) => r.includes('.contatti-title'))).toBe(false);
    });
  });

  describe('stripPseudo', () => {
    it('rimuove pseudo-elementi e pseudo-classi', () => {
      expect(stripPseudo('.menu-toggle::before')).toBe('.menu-toggle');
      expect(stripPseudo('.menu-toggle:hover')).toBe('.menu-toggle');
      expect(stripPseudo('.menu-toggle::before:hover')).toBe('.menu-toggle');
    });

    it('rimuove pseudo-classi funzionali', () => {
      expect(stripPseudo('.card:nth-child(2)')).toBe('.card');
    });
  });

  describe('extractElementContext', () => {
    it('part html per pagina index', () => {
      const el = document.createElement('button');
      el.className = 'menu-toggle';
      el.textContent = 'Menu';
      const ctx = extractElementContext(el, '.menu-toggle { display: none; }', 'index', '100%');
      expect(ctx.part).toBe('html');
      expect(ctx.page).toBe('index');
      expect(ctx.viewport).toBe('100%');
      expect(ctx.html).toContain('menu-toggle');
      expect(ctx.cssRules).toContain('.menu-toggle { display: none; }');
      expect(ctx.computed['display']).toBeDefined();
    });

    it('part pagesHtml per pagina secondaria', () => {
      const el = document.createElement('h1');
      el.textContent = 'Chi siamo';
      const ctx = extractElementContext(el, '', 'about', '375px');
      expect(ctx.part).toBe('pagesHtml');
      expect(ctx.page).toBe('about');
      expect(ctx.viewport).toBe('375px');
    });

    it('computed include variabili custom', () => {
      const el = document.createElement('button');
      el.style.setProperty('--font', '"Playful"');
      const ctx = extractElementContext(el, '', 'index', '100%');
      expect(ctx.computed['--font']).toBe('"Playful"');
    });

    it('outerHTML senza artefatti picker (outline/outlineOffset inline)', () => {
      const el = document.createElement('div');
      el.className = 'brand';
      el.style.outline = '2px solid #4f46e5';
      el.style.outlineOffset = '1px';
      const ctx = extractElementContext(el, '', 'index', '100%');
      expect(ctx.html).toBe('<div class="brand"></div>');
      expect(ctx.html).not.toContain('outline');
    });

    it('rimuove artefatti picker anche dai figli', () => {
      const el = document.createElement('div');
      el.className = 'brand';
      const child = document.createElement('span');
      child.style.outlineOffset = '1px';
      el.appendChild(child);
      const ctx = extractElementContext(el, '', 'index', '100%');
      expect(ctx.html).toBe('<div class="brand"><span></span></div>');
    });

    it('preserva altri stili inline', () => {
      const el = document.createElement('div');
      el.className = 'brand';
      el.style.color = 'red';
      el.style.outlineOffset = '1px';
      const ctx = extractElementContext(el, '', 'index', '100%');
      expect(ctx.html).toBe('<div class="brand" style="color: red;"></div>');
    });
  });

  describe('findElementInSource', () => {
    it('trova l\'elemento nel sorgente', () => {
      expect(findElementInSource('<div><button class="menu-toggle">Menu</button></div>', '<button class="menu-toggle">Menu</button>')).toBe(true);
    });

    it('tollera differenze di whitespace', () => {
      expect(findElementInSource('<div>\n  <button class="menu-toggle">Menu</button>\n</div>', '<button class="menu-toggle">Menu</button>')).toBe(true);
    });

    it('false se l\'elemento non c\'è più', () => {
      expect(findElementInSource('<div><button class="other">X</button></div>', '<button class="menu-toggle">Menu</button>')).toBe(false);
    });

    it('false su input vuoti', () => {
      expect(findElementInSource('', '<button>X</button>')).toBe(false);
      expect(findElementInSource('<div>X</div>', '')).toBe(false);
    });
  });
});
