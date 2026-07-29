# Firecrawl

Use Firecrawl for fast, reliable web context: search, scrape, interact with live pages, parse documents, and monitor changes.

## When to use

- Need to extract content from a public URL (text, images, brand colors, logo).
- Need to search the web for sources first.
- Need browser actions (click, form, login) before extraction.
- Need to parse a local PDF/DOCX into markdown.
- Need to monitor a page for changes.

## When NOT to use

- Never call Firecrawl from the browser with the API key. Use only server-side.
- Do not use Firecrawl for illegal scraping, password-protected pages without permission, or sites that explicitly disallow scraping in robots.txt for the requested scope.

## Credentials

Requires `FIRECRAWL_API_KEY` in server environment (Vercel/.env). The browser never sees it.

- Dashboard: https://www.firecrawl.dev
- Free tier: 1,000 credits/month (1 credit ≈ 1 page scrape).
- Auth header: `Authorization: Bearer fc-...`
- Base URL: `https://api.firecrawl.dev/v2`

## API endpoints used in this project

### `POST /v1/scrape`

Scrape a single URL and return clean markdown + branding info.

Request body:

```json
{
  "url": "https://example.com",
  "formats": ["markdown", "branding"],
  "onlyMainContent": true,
  "timeout": 30000
}
```

Response fields used:

- `data.markdown` — page content.
- `data.metadata.title` — page title.
- `data.metadata.description` — meta description.
- `data.branding.logo` — logo URL.
- `data.branding.colors.primary/secondary/accent/background/textPrimary` — brand colors.
- `data.branding.fonts` — font families.
- `data.links` — page links.

### `POST /v1/crawl` (optional)

Crawl multiple pages from a site map. Use when one page is not enough.

Request body:

```json
{
  "url": "https://example.com",
  "limit": 5,
  "formats": ["markdown"],
  "onlyMainContent": true
}
```

### `POST /v1/search`

Search the web by query.

```json
{
  "query": "pizzeria Napoli centro",
  "limit": 5
}
```

## Project integration

Integration lives in `api/index.ts`:

- `fetchFirecrawlPage(url)` — calls `/v1/scrape`, returns normalized result.
- `/customers/:id/research` — uses Firecrawl on the customer website.
- Extracted chunks are saved to `customer_knowledge` table.
- Logo URL from branding is used as `detectedLogoUrl` if available.

## Security

- `FIRECRAWL_API_KEY` is read only from `process.env` inside `api/index.ts`.
- Never log the full key.
- Never return Firecrawl response raw to the browser; clamp/sanitize first.
- Reject private/internal IPs before calling Firecrawl (SSRF guard).

## Local dev

LOCAL mode does not call Firecrawl. `researchStatus.web` will be `no_key` unless you set `FIRECRAWL_API_KEY` in your `.env` and restart the dev server.

## Rate limits

Research is rate-limited to 1/hour per customer in `api/index.ts` via `consumeRateLimit`.

## Testing

Mock Firecrawl in tests by stubbing `global.fetch` to `api.firecrawl.dev` or by mocking `fetchFirecrawlPage`. Do not use real API key in tests.

## Useful links

- Docs: https://docs.firecrawl.dev
- Pricing: https://www.firecrawl.dev/pricing
