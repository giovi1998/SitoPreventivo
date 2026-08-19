# C6 - Design tokens editor (advisory detector) — CHIUSO

## Question

Il detector impeccable segnalava ~100 advisory (font-size/colori/radius
hardcoded nei CSS editor: card ~68, flyer 24, + social/website/logo/
editor minori 8). Pattern sistemico pre-token. Azione: mappare i CSS
editori su var(--text/--surface/--border/--accent/--muted/--radius-*) e
la type ramp documentata, quando DESIGN.md tokens esiste.

## Resolution (2026-08-19)

1. **Root cause detector**: DESIGN.md `typography.sizeScale` era una
   lista YAML, il parser (parseYamlSubset) non supporta liste → la type
   ramp era invisibile al detector → ~240 falsi positivi font-size.
   Fix: convertita in `typography.scale` (mappa nome→size).
   Risultato: 386 → 147 finding.
2. **Colori legacy → token** (147 → 12):
   - LogoAiPanel: #ccc/#ddd/#eee/#d0d0d0 → var(--line)/var(--line-lt),
     #080→var(--green), #c00→var(--red), #06c→var(--info-link),
     #f5f5f5→var(--surface-sun), #fff→var(--surface), rgba neri→
     color-mix su token.
   - CookieBanner/ElementPickerPanel/OnboardingModal: var(--text, #333)
     /var(--text-muted, #666)/var(--muted, #5c5c5c) → var(--ink-sec)/
     var(--muted) (+ aggiunti `--text`/`--text-muted` in GlobalStyles).
   - cardGridForm #b00020→var(--red); WebsiteEditor #e11d48→var(--red),
     #333→var(--line); AILogPanel #10B981→var(--success), neon log →
     nuovi token --ai-log-cyan/green/rose/violet in GlobalStyles +
     DESIGN.md frontmatter; ErrorBoundary inline styles → ErrorBoundary.css
     con token.
   - Documenti (cardPreviewSide/cardBase/flyer preview): color-mix su
     var(--ink), mai hardcoded rgba neri.
3. **Colori intenzionali documentati in DESIGN.md frontmatter** (+
   sidecar `.impeccable/design.json` colorMeta e shadows): social brand
   (facebook/linkedin/instagram), AI log dark palette, CRM blues/violet.
   Le ombre rgba(0,0,0,x) sono nel vocabolario sidecar `shadows`.
4. **Risultato finale**: `design-system-color` fuori GlobalStyles → **0**
   (12 restanti sono le definizioni token dentro GlobalStyles.tsx, falsi
   positivi del detector). Font-size: document render (cardPreview 9px/
   1.6-4rem, flyer) restano intenzionali (render documento, non UI).

Gate: typecheck ✅, 64 test mirati ✅ (LogoAiPanel 32, ErrorBoundary,
OnboardingModal, QREditor, SocialEditor+responsive, WebsiteEditor,
CookieBanner).
