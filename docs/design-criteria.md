# Criteri di design — card / logo / flyer

Raccolta di criteri consolidati (fonti online, 2026-08-06) usati come riferimento
per il design review dei tre generatori. Ogni fix di Fase 2 deve poter puntare a
un criterio di questo documento.

## Business card (85×55mm EU / 3.5×2in US)

- **Dimensioni**: 85×55mm standard EU/UK ([Corel](https://learn.corel.com/tutorials/design-a-business-card-in-corel-vector/), [DiscoverPrint](https://discoverprint.co.uk/blog/business-card-size-guide-uk/)); 3.5×2in (88.9×50.8mm) US ([Apex Workwear](https://apexworkwear.ca/business-card-bleed-and-safe-area/)).
- **Bleed**: 3mm per lato ([Vistaprint](https://www.vistaprint.com/hub/crop-marks-explained), [Jukebox](https://support.jukeboxprint.com/en/articles/3575990-how-to-calculate-bleed-and-safety-margin)).
- **Safe area**: ≥4mm dai bordi per testo/elementi importanti ([Original Copy Centre](https://www.copycentre.com/artwork/)). Su 85×55mm → area utile ~77×47mm.
- **Gerarchia tipografica**: nome (o company) = testo più grande, letto per primo; ruolo/tagline = medio; contatti = piccolo ma mai sotto ~7.5–8pt in stampa; minimo pratico raccomandato 8–9pt ([Mobilo](https://www.mobilocard.com/post/best-fonts-for-business-cards)).
  - Conversione per la preview a 640px logici (card 85mm → 640px, scala ~7.53px/mm, 1pt ≈ 0.353mm): 8pt ≈ 2.82mm ≈ **~21px logici**; 7pt ≈ ~19px. Sotto ~19px logici i contatti risultano illeggibili → criterio minimo adottato: **contatti ≥ 19px logici, ideale ≥ 21px**.
- **Font**: massimo 1–2 famiglie; gerarchia via peso/stile, non via nuovi font ([Mobilo](https://www.mobilocard.com/post/best-fonts-for-business-cards)).
- **Line height**: 1.125–1.2× la dimensione del font per leggibilità ([Figma](https://www.figma.com/resource-library/typography-in-design/)).

## Logo

- **Struttura premium**: icona centrata + una riga di testo sotto; niente stacking, niente bordi; negativo space come alleato ([Pixazo](https://www.pixazo.ai/logo/brand/maker)).
- **Leggibilità a piccole dimensioni**: il wordmark deve restare leggibile anche in scala ridotta (favicon, card); testare sempre al minimo ([4OVER4](https://www.4over4.com/content-hub/stories/best-practices-for-logo-design)).
- **Testo minimo**: altezza x del testo principale ≥ ~6mm equivalente stampa per lettura a distanza braccio; testo secondario (tagline) ≥ ~3.8mm ([Papacko](https://papacko.com/cup-sleeves/) — guideline etichette, stesso principio di scala).
- **Contrasto**: testo su `backgroundImage` richiede contrasto forte (backdrop/scrim), non affidarsi al colore solo ([podcast artwork guidelines](https://propodcastsolutions.com/how-to-design-podcast-artwork-design-principles-for-maximum-impact/)).
- **Clear space / exclusion zone**: margine di rispetto attorno al logo ≥ metà altezza di un glifo rappresentativo ([Hopin brand guidelines](https://branding.hopintaxi.com/)).
- **Max 2 font**; peso bold per il nome, lighter per tagline ([podcast artwork](https://propodcastsolutions.com/how-to-design-podcast-artwork-design-principles-for-maximum-impact/)).

## Flyer / volantino (A5 148×210mm default)

- **Dimensioni**: A5 = 148×210mm; A6 = 105×148mm ([Leafletfrog](https://www.leafletfrog.co.uk/blogs/news/how-to-create-an-a5-flyer-for-printing-marketing/)).
- **Bleed**: 3mm; **safe zone**: 5–10mm dal bordo di taglio per testo/logo/QR ([Brandon Archibald](https://brandon-archibald.art/how-to-prepare-layouts-for-printing-tips-from-professionals/), [Leafletfrog A6](https://www.leafletfrog.co.uk/blogs/news/a6-flyer-dimensions-for-printing-design-setup/)).
- **Gerarchia a 3 livelli**: heading > subheading > body ([Toptal](https://www.toptal.com/designers/typography/typographic-hierarchy)).
- **Font size stampa**: body 10–12pt (≈3.5–4.2mm); sotto 10pt il body è un azzardo; headline sotto 24pt (≈8.5mm) non cattura attenzione ([Pagination](https://pagination.com/best-fonts-for-brochures-flyers-and-booklets/), [4OVER4](https://www.4over4.com/guide/how-to-design-flyers)).
  - In unità SVG del flyer (user unit = mm): **body ≥ 3.5, headline ≥ 8.5, CTA ≥ body e visivamente distinta**.
- **One goal rule**: un solo messaggio, una sola CTA ([Formax](https://www.formaxprinting.com/sr.a4-brochure-design-tips-for-perfect-flyers), [4OVER4](https://www.4over4.com/guide/how-to-design-flyers)).
- **Palette 60-30-10**: 60% dominante (sfondo), 30% secondario, 10% accento per CTA ([Apex Workwear](https://apexworkwear.ca/how-to-design-a-flyer-for-printing/)).
- **Max 2 font**: bold sans per headline, leggibile per body ([Apex Workwear](https://apexworkwear.ca/how-to-design-a-flyer-for-printing/)).

## Sintesi operativa per il codebase

| Modulo | Min testo | Gerarchia | Safe margin |
|---|---|---|---|
| Card (640px logici) | contatti ≥ 19px (~7pt) | nome ≫ ruolo > company > contatti | ≥ 4mm ≈ 30px logici |
| Logo | tagline ≥ ~40% del wordmark | wordmark > tagline; icona proporzionata | exclusion zone ≥ ½ glifo |
| Flyer (mm) | body ≥ 3.5mm, headline ≥ 8.5mm | heading > sub > body > CTA | 5–10mm |
