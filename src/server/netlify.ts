import https from 'node:https';
import crypto from 'node:crypto';

/**
 * TB-012: deploy landing statica su Netlify (server-side). Condiviso da
 * handler.ts (prod) e dal dev proxy Vite (locale). Token mai esposto al
 * browser. Site per cliente (nome stabile `quickbrand-<slug>`): crea alla
 * prima esecuzione, poi deploy con upload file → URL preview (draft).
 *
 * Metodo: file digest (docs.netlify.com "Deploy with the API"). Un POST
 * con il digest JSON del file → Netlify risponde con la lista di file da
 * uploadare (PUT body grezzo); il file in path `/index.html` viene servito
 * come entry point con Content-Type corretto. (ZIP e multipart falliscono:
 * zip = file orfani, multipart = non supportato.)
 */

/** Slug Netlify-safe: minuscolo, a-z0-9-, max 39. */
export function sanitizeNetlifyName(raw: string): string {
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (slug || 'cliente').slice(0, 39);
}

// lean-code: helper unico per chiamate Netlify API (GET + JSON + upload).
// Ceiling: retry/backoff se la rate-limit Netlify diventa un problema.
function netlifyRequest(
  token: string,
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: Record<string, unknown> | Buffer | string,
  headers?: Record<string, string>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const payload = body == null ? null : isBuffer ? body : typeof body === 'string' ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname: 'api.netlify.com',
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(payload ? { 'Content-Type': headers?.['Content-Type'] || 'application/json' } : {}),
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let parsed: unknown = text;
        try { parsed = text ? JSON.parse(text) : null; } catch { /* body non-JSON */ }
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const msg = typeof parsed === 'object' && parsed !== null && typeof (parsed as any).msg === 'string'
            ? (parsed as any).msg
            : text.slice(0, 200);
          reject(new Error(`Netlify API ${res.statusCode}: ${msg}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

/**
 * Deploy una landing HTML su Netlify. Ritorna { deployUrl (preview draft),
 * siteUrl, siteId }. Throws su errore Netlify.
 *
 * Il file è sempre `/index.html` (entry point del site). `fileName` resta
 * nel payload di risposta solo per tracciabilità del chiamante.
 */
export async function deployLandingHtml(
  token: string,
  siteName: string,
  html: string,
  fileName: string,
  pollMs = 2500,
  maxPolls = 8,
): Promise<{ deployUrl: string; siteUrl: string; siteId: string; fileName: string }> {
  let existing = null;
  try {
    const list = await netlifyRequest(token, `/api/v1/sites?filter=all`, 'GET');
    existing = Array.isArray(list) ? list.find((s: any) => s.name === siteName) : null;
  } catch (err) {
    // 404 = site mai creato → procedi con la creazione.
    console.warn('[netlify] list sites fallita (creo il site)', String(err));
  }
  const site = existing
    ? existing
    : await netlifyRequest(token, `/api/v1/sites`, 'POST', { name: siteName, ssl_url: undefined });
  const digest = await netlifyRequest(token, `/api/v1/sites/${site.id}/deploys`, 'POST', {
    files: { '/index.html': sha1(html) },
  });
  const deployId = String(digest.id || '');
  const required: string[] = Array.isArray(digest.required) ? digest.required : [];
  for (const fileSha of required) {
    await netlifyRequest(token, `/api/v1/deploys/${deployId}/files/index.html`, 'PUT', html, {
      'Content-Type': 'application/octet-stream',
    });
  }
  let state = String(digest.state || '');
  for (let i = 0; i < maxPolls && state && state !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    const polled = await netlifyRequest(token, `/api/v1/deploys/${deployId}`, 'GET');
    state = String(polled.state || state);
  }
  return {
    deployUrl: String(digest.deploy_url || ''),
    siteUrl: String(digest.url || ''),
    siteId: String(site.id || ''),
    fileName,
  };
}
