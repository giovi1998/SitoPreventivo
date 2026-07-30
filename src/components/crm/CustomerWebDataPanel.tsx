import React from 'react';

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function normalizeColors(colors: unknown): string[] {
  if (Array.isArray(colors)) return colors.filter((c): c is string => typeof c === 'string');
  if (colors && typeof colors === 'object') return Object.values(colors).filter((c): c is string => typeof c === 'string');
  return [];
}

function normalizeImages(images: unknown): string[] {
  return Array.isArray(images) ? images.filter((u): u is string => typeof u === 'string') : [];
}

function normalizeLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
}

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    document.body.removeChild(ta);
  }
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === '' ? '—' : String(value);
  return (
    <div className="crm-field">
      <span className="crm-field-label">{label}</span>
      <span className="crm-field-value">{text}</span>
    </div>
  );
}

interface CustomerWebDataPanelProps {
  webData: Record<string, unknown>;
}

export function CustomerWebDataPanel({ webData }: CustomerWebDataPanelProps): React.ReactElement {
  const markdownFull = typeof webData.markdownFull === 'string' && webData.markdownFull ? webData.markdownFull : null;
  const siteColors = normalizeColors(webData.colors);
  const siteImages = normalizeImages(webData.images);
  const siteScreenshot = typeof webData.screenshot === 'string' ? webData.screenshot : null;
  const siteLinks = normalizeLinks(webData.links);
  const siteJson = (webData.json || null) as Record<string, unknown> | null;
  const siteBranding = (webData.branding || null) as Record<string, unknown> | null;
  const brandingLogo = typeof siteBranding?.logo === 'string' ? siteBranding.logo : typeof webData.brandingLogo === 'string' ? webData.brandingLogo : null;
  const brandingColors = Array.from(new Set(normalizeColors(siteBranding?.colors || webData.brandingColors || webData.colors)));
  const brandingFonts = Array.isArray(siteBranding?.fonts) ? (siteBranding.fonts as unknown[]).filter((f): f is string => typeof f === 'string') : [];

  return (
    <section className="crm-section" data-testid="crm-nap-section">
      <h3>Dati dal sito</h3>
      <div className="crm-webdata-grid">
        <div className="crm-webdata-main">
          <Field label="Titolo" value={webData.title} />
          <Field label="Descrizione" value={webData.description || siteJson?.company_description} />
          {siteJson?.company_name ? <Field label="Nome attività (AI)" value={siteJson.company_name} /> : null}
          {markdownFull ? (
            <details className="crm-markdown-toggle" data-testid="crm-markdown-toggle">
              <summary>Mostra tutto il markdown ({markdownFull.length} caratteri)</summary>
              <pre className="crm-markdown-full" data-testid="crm-markdown-full">{markdownFull}</pre>
            </details>
          ) : (
            <>
              <Field label="Preview" value={webData.markdownPreview} />
              {webData.markdownPreview ? (
                <p className="crm-note" data-testid="crm-markdown-partial-note">Solo preview (500 caratteri): il markdown completo non è ancora persistito.</p>
              ) : null}
            </>
          )}
          {siteJson && Object.keys(siteJson).length > 0 && (
            <details className="crm-json-toggle" data-testid="crm-json-toggle">
              <summary>Dati strutturati JSON</summary>
              <pre className="crm-json-full" data-testid="crm-json-full">{JSON.stringify(siteJson, null, 2)}</pre>
            </details>
          )}
          {siteLinks.length > 0 && (
            <div className="crm-webdata-links" data-testid="crm-webdata-links">
              <span className="crm-field-label">Link trovati ({siteLinks.length})</span>
              <ul>
                {siteLinks.slice(0, 20).map((u, i) => (
                  <li key={i}>
                    <a href={u} target="_blank" rel="noreferrer">{u}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brandingColors.length > 0 && (
            <div className="crm-webdata-colors" data-testid="crm-webdata-colors">
              <span className="crm-field-label">Colori branding</span>
              {brandingColors.map((hex) => (
                <button key={hex} type="button" className="crm-color-chip" onClick={() => void copyTextToClipboard(hex)} title={`Copia ${hex}`} data-testid={`crm-color-chip-${hex}`}>
                  <span className="crm-color-swatch" style={{ background: hex }} />
                  <span className="crm-color-hex">{hex}</span>
                </button>
              ))}
            </div>
          )}
          {brandingFonts.length > 0 && (
            <div data-testid="crm-webdata-fonts">
              <Field label="Font branding" value={brandingFonts.join(', ')} />
            </div>
          )}
        </div>
        <div className="crm-webdata-side">
          {siteScreenshot && (
            <div className="crm-webdata-screenshot" data-testid="crm-webdata-screenshot">
              <span className="crm-field-label">Screenshot</span>
              <a href={siteScreenshot.startsWith('data:') ? undefined : siteScreenshot} target="_blank" rel="noreferrer">
                <img src={siteScreenshot} alt="Screenshot sito" className="crm-screenshot-img" />
              </a>
            </div>
          )}
          {brandingLogo && (
            <div className="crm-webdata-logo" data-testid="crm-webdata-logo">
              <span className="crm-field-label">Logo rilevato</span>
              <a href={brandingLogo} target="_blank" rel="noreferrer">
                <img src={brandingLogo} alt="Logo rilevato" className="crm-webdata-thumb" />
              </a>
            </div>
          )}
          {siteImages.length > 0 && (
            <div className="crm-webdata-images" data-testid="crm-webdata-images">
              <span className="crm-field-label">Immagini ({siteImages.length})</span>
              <div className="crm-webdata-image-grid">
                {siteImages.slice(0, 12).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" title="Apri immagine in nuova scheda">
                    <img src={u} loading="lazy" alt={`Immagine sito ${i + 1}`} className="crm-webdata-thumb" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CustomerWebDataPanel;
