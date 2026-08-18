# C6 - Design tokens editor (advisory detector)

## Question

Il detector impeccable segnala ~100 advisory (font-size/colori/radius
hardcoded nei CSS editor: card ~68, flyer 24, + social/website/logo/
editor minori 8). Pattern sistemico pre-token, non bloccante. Azione
quando si introduce DESIGN.md tokens: mappare i CSS editori su
var(--text/--surface/--border/--accent/--muted/--radius-*) e la type
ramp documentata. Nota: nel frattempo i valori hardcoded sono
intenzionali e allineati alla palette GlobalStyles.tsx — non è drift
erratico, è pre-token legacy (commento in cardPreviewSide.css:21 lo
dimostra: palette coerente). Non aprire adesso: attendere DESIGN.md.
