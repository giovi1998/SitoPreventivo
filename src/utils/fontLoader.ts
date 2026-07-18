/**
 * Lazy loader per le famiglie di font dei picker documento (Phase 13b,
 * REQ-DS-005). Queste famiglie servono solo quando l'utente apre un font
 * picker (card, flyer, quote, logo): caricarle all'avvio costa ~14 famiglie
 * di rete anche a chi non le userà mai.
 *
 * Inter/Outfit/JetBrains Mono NON sono qui: sono caricati staticamente in
 * index.html perché sono i font dell'UI chrome.
 */

const DOCUMENT_FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  'family=DM+Sans:wght@400;600;700' +
  '&family=Figtree:wght@400;600;700' +
  '&family=Lato:wght@400;700' +
  '&family=Merriweather:wght@400;700' +
  '&family=Montserrat:wght@400;600;700' +
  '&family=Open+Sans:wght@400;600;700' +
  '&family=Oswald:wght@400;600;700' +
  '&family=Playfair+Display:wght@400;700' +
  '&family=Plus+Jakarta+Sans:wght@400;600;700' +
  '&family=Poppins:wght@400;600;700' +
  '&family=Raleway:wght@400;600;700' +
  '&family=Roboto:wght@400;500;700' +
  '&family=Source+Sans+3:wght@400;600;700' +
  '&display=swap';

const LINK_ID = 'qb-document-fonts';
let injected = false;

/**
 * Inietta il <link> Google Fonts con le famiglie picker. Idempotente:
 * chiamate successive sono no-op.
 */
export function ensureDocumentFonts(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById(LINK_ID)) {
    injected = true;
    return;
  }
  const link = document.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = DOCUMENT_FONTS_URL;
  document.head.appendChild(link);
  injected = true;
}

/** Solo per test: resetta lo stato del loader. */
export function resetDocumentFontsForTest(): void {
  injected = false;
  if (typeof document !== 'undefined') {
    document.getElementById(LINK_ID)?.remove();
  }
}
