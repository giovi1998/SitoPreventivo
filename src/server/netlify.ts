import https from 'node:https';

/**
 * TB-012: deploy landing statica su Netlify (server-side). Condiviso da
 * handler.ts (prod) e dal dev proxy Vite (locale). Token mai esposto al
 * browser. Site per cliente (nome stabile `quickbrand-<slug>`): crea alla
 * prima esecuzione, poi deploy con upload file → URL preview (draft).
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
  method: 'GET' | 'POST',
  body?: Record<string, unknown> | Buffer,
  headers?: Record<string, string>,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const payload = isBuffer ? body : body ? Buffer.from(JSON.stringify(body)) : null;
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

/**
 * Deploy una landing HTML su Netlify. Ritorna { deployUrl (preview draft),
 * siteUrl, siteId }. Throws su errore Netlify.
 */
export async function deployLandingHtml(
  token: string,
  siteName: string,
  html: string,
  fileName: string,
): Promise<{ deployUrl: string; siteUrl: string; siteId: string }> {
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
  const formBody = Buffer.from(
    `--qb\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/html\r\n\r\n${html}\r\n--qb--\r\n`,
  );
  const deploy = await netlifyRequest(token, `/api/v1/sites/${site.id}/deploys`, 'POST', formBody, {
    'Content-Type': 'multipart/form-data; boundary=qb',
  });
  return {
    deployUrl: String(deploy.deploy_url || ''),
    siteUrl: String(deploy.url || ''),
    siteId: String(site.id || ''),
  };
}
