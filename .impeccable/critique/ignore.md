# Ignore detector findings for the polished shell

## side-tab: border-left 4px su .doc-callout-warning / .doc-callout-info
Sono callout informativi (warning/success) — pattern legittimo che marca una sezione critica senza invadere il layout. Non è una "side stripe" decorativa: è funzionale al testo.

## overused-font: Inter / Roboto Mono (x4)
Sono il font body/documento designato (DESIGN.md). La rule segnala "monospace as costume": Roboto Mono è usato solo per raw output (AI logs, tokens). Inter è il body font — non è sovraccarico decorativo.

## layout-transition: transition: width (GlobalStyles.tsx)
Animazione width sul collapse dei pannelli editor (.editor-col.collapsed). È l'unica transizione larga del sistema, legittima per la progressive disclosure del layout.

## layout-transition: transition: width (PdfImportModal.tsx:175, WebsiteEditor.css:537, SettingsPage.css:66)
Tutte barre di avanzamento o preview con width calcolato: la transizione è funzionale (mostra avanzamento), non decorativa.

## broken-image: selettori <img> in cardPreviewSide.css
Il detector vede `<img>` nel codice CSS e pensa a tag rotto: è un selettore di stile (` .card-preview-side img { ... }`), non l'elemento HTML.

## Status: no P0/P1/P2/P3/P4 formal findings on the polished shell. Advisory design-system drift is a separate, opt-in migration (code → token alignment).
