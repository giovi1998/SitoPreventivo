---
schemaVersion: 1
scope: workspace
updatedAt: "2026-05-26T20:10:52.338Z"
workspaceName: "SitoPreventivo"
---

# Project Memory

## Project Overview
- Workspace per creare un’app web per generare preventivi personalizzabili: colori, testi, sezioni e struttura documento.
- L’idea è una sorta di “Claude design” applicato ai preventivi: l’utente costruisce/modifica il preventivo sia manualmente sia tramite AI, e gestisce una raccolta di preventivi salvati.

## Current State
- Esiste un prototipo visuale React chiamato “PrecisionQuote” / “Preventivi Custom App”.
- L’app è focalizzata su due aree principali: editor preventivo e pagina “Collection”; la dashboard è stata rimossa.
- L’editor è la parte core: include modifica manuale dei contenuti, assistente AI che applica modifiche visibili, anteprima documento stile PDF, gestione box/sezioni, 10 stili e 10 colori selezionabili.
- Ogni parte core del preventivo è compilabile/modificabile: dati cliente, testi, voci economiche, sezioni, box e struttura documento.
- `App.jsx` resta self-contained per compatibilità con runner/preview: un tentativo con import statici dai componenti `src` ha fallito nel runner con “Cannot use import statement outside a module”.
- I componenti in `src/components/` sono stati migliorati/preparati per una migrazione modulare reale, ma non sono ancora usati dal runner principale.
- `src/main.jsx` monta ancora `../App.jsx`; quindi la preview verificata usa ancora il file principale self-contained.
- Errore “Identifier 'Topbar' has already been declared” corretto rinominando il componente locale in `AppTopbar`.
- È stato aggiunto un template/preventivo iniziale “sito web per Francesca”, con voci economiche, sezioni, timeline, materiali richiesti e condizioni già compilati.
- È stato aggiunto un comando AI “Template sito Francesca” per rigenerare/applicare velocemente quel preventivo.
- Preview/verifica più recente: 287 nodi, 0 errori console, 0 errori asset; verifica finale ok.
- Sono presenti `favicon.svg` e `.well-known/appspecific/com.chrome.devtools.json` per eliminare i 404 locali segnalati.
- `README.md` e `DESIGN.md` chiariscono lo stato: app self-contained per runner, componenti `src` pronti per collegamento in ambiente modulare.

## Artifacts
- `App.jsx`: prototipo principale self-contained con shell SaaS, editor preventivo avanzato, AI assistant applicativo, preview documento, collection e template “sito web per Francesca”; resta l’entry compatibile col runner.
- `src/main.jsx`: entry React allineata per montare l’app dal file principale.
- `src/components/EditorView.jsx`: componente modulare candidato per l’editor manuale/AI.
- `src/components/DocumentPreview.jsx`: componente modulare candidato per anteprima documento tipo PDF.
- `src/components/CollectionView.jsx`: componente modulare candidato per lista preventivi e azioni.
- `src/components/AuthorQuoteTemplate.jsx`: template preventivo storico/iniziale, non ancora integrato davvero nell’app corrente.
- `src/components/GlobalStyles.jsx`, `Icon.jsx`, `Layout.jsx`, `Topbar.jsx`: componenti sorgente aggiornati/preparati per futura modularizzazione reale.
- `src/constants.js`: costanti/preset storici ancora presenti.
- `README.md`: documentazione del progetto con funzionalità, struttura, avvio locale e nota sul limite runner/import.
- `favicon.svg`: favicon locale per evitare 404 su `/favicon.ico`/asset browser equivalenti.
- `.well-known/appspecific/com.chrome.devtools.json`: endpoint locale vuoto per evitare 404 generato da Chrome DevTools.
- `DESIGN.md`: design-system del workspace con direzione visiva, token e componenti riutilizzabili. È l’unico riferimento autorevole per decisioni visual/system.

## Design Direction
- Direzione professionale/SaaS: interfaccia da prodotto operativo, con sidebar, editor centrale e preview documento.
- Focus su chiarezza, produttività e controllo: editing rapido, personalizzazione manuale e modifiche tramite AI.
- Documento preventivo presentato come anteprima tipo PDF, adatto a esportazione/condivisione.
- Stile premium e ordinato, evitando un aspetto troppo generico.
- L’AI deve comportarsi come un co-editor alla “Claude design”: non solo chat testuale, ma modifiche concrete al preventivo.
- Layout responsive: a larghezze tipo 1280px l’anteprima non deve risultare troppo tagliata rispetto all’editor.

## User Feedback
- Lingua e contenuto in italiano.
- Il sito deve aiutare a fare preventivi.
- Tutto deve essere customizzabile: colori, scritte, sezioni e box.
- Deve esserci un editor core ben fatto, non solo “create new”.
- Deve esserci una pagina “Collection” per vedere vecchi preventivi, duplicare, eliminare ecc.
- La dashboard non ha senso in questa fase ed è stata tolta.
- La chat AI va bene, ma deve modificare davvero il preventivo.
- Deve rimanere possibile modificare tutto manualmente.
- Per ora servono 10 stili e 10 colori.
- L’utente ha chiesto di poter fare un preventivo sito per Francesca; ora esiste un template già compilato.
- L’utente ha chiesto di sistemare errori/404 in locale e aggiornare anche il README.
- L’utente ha chiesto di ricollegare `App.jsx` ai componenti `src`; è stato chiarito e documentato che il runner impone ancora `App.jsx` self-contained.
- Codice iniziale fornito: generatore preventivo PDF in HTML/Tailwind per Giovanni Cidu, con esportazione PDF client-side e preventivo sito web su 3 pagine.

## Decisions
- Nome design/prototipo corrente: “Preventivi Custom App”.
- Workspace name: “SitoPreventivo”.
- È stato adottato un modello app SaaS con navigazione e gestione documenti, non solo una pagina statica.
- Le aree principali sono Editor e Collection; dashboard rimossa.
- L’editor è la parte centrale del prodotto.
- L’app supporta doppia modalità di modifica: manuale + AI applicativa.
- Per compatibilità con il runner corrente, `App.jsx` è mantenuto come artefatto principale self-contained.
- I componenti `src` sono candidati modulari/preparati, ma non collegati alla preview principale finché l’ambiente non supporta import statici/moduli in modo standard.
- Per evitare collisioni con componenti modulari, il topbar interno di `App.jsx` è stato rinominato `AppTopbar`.
- Il preventivo “sito web per Francesca” è un caso d’uso/template concreto disponibile nell’editor.
- `DESIGN.md` rimane l’unico riferimento autorevole per il sistema visivo.

## Open Questions
- Persistenza dati: locale, database, account utente o integrazione cloud?
- Esportazione finale: PDF client-side, server-side o entrambi?
- Quanto deve essere avanzato l’assistente AI per testi/sezioni/prezzi?
- Quali campi devono essere obbligatori nei preventivi?
- Serve gestione clienti/anagrafiche oltre alla collection preventivi?
- Serve supporto multi-template o solo template iniziali personalizzabili?
- Come rappresentare la modifica libera di ogni box: inline editing, form laterale o entrambi?
- Quando migrare davvero verso componenti modulari in `src/` in ambiente Vite/React standard?
- Integrare `AuthorQuoteTemplate.jsx` come template reale selezionabile?

## Next Steps
- Raffinare il template “sito Francesca” con dati reali: servizi inclusi, prezzo finale, tempistiche, condizioni e tono.
- In ambiente modulare standard, collegare davvero `App.jsx` a `Layout`, `Topbar`, `EditorView`, `DocumentPreview`, `CollectionView` e costanti condivise.
- Definire flussi reali: nuovo preventivo, salvataggio, duplicazione, eliminazione, esportazione.
- Rendere persistenti le modifiche manuali e AI su dati strutturati.
- Raffinare l’editor inline per ogni box/sezione del documento.
- Aggiungere gestione template/brand: logo, palette, font, intestazioni, footer.
- Collegare la collection a dati reali o mock strutturati.
- Valutare importazione del contenuto del generatore HTML iniziale come template “Preventivo sito web”.
- Rifinire responsive mobile/tablet e stati vuoti/errori.
- Definire meglio i 10 stili disponibili e il loro impatto visivo sul documento.

## Promotion Candidates For DESIGN.md
- Shell SaaS con navigazione essenziale: Editor + Collection, senza dashboard.
- Pattern editor core con tre elementi: controlli manuali, AI applicativa, preview PDF live.
- AI come co-editor che modifica contenuti/sezioni/stile del preventivo, non solo chatbot.
- Pattern documento preventivo stile PDF come componente centrale.
- Azioni collection standard: modifica, duplica, elimina.
- Personalizzazione brand come feature primaria: colori, testi, sezioni, stili.
- 10 preset colore e 10 preset stile come base iniziale di personalizzazione.
- Template verticali pronti, come “sito web per Francesca”, applicabili via AI e modificabili manualmente.
- Linguaggio UI professionale e orientato a preventivi/consulenze.
- Layout responsive che preserva leggibilità di editor e preview anche su desktop medio.
- Separazione futura consigliata: `App.jsx` orchestratore + componenti modulari `src/components`.

## Recent History
- 2026-05-26: Creato workspace design “Preventivi Custom App” e `DESIGN.md`.
- 2026-05-26: Creato `App.jsx` con prototipo editor preventivi + collection.
- 2026-05-26: Dashboard rimossa; editor reso core con AI applicativa, modifica manuale, sezioni/box, 10 stili e 10 colori.
- 2026-05-26: Aggiunti `favicon.svg` e `.well-known/appspecific/com.chrome.devtools.json`; aggiornato `README.md`.
- 2026-05-26: `App.jsx` reso self-contained per compatibilità col runner; `src/main.jsx` allineato.
- 2026-05-26: Corretto errore sintattico in `App.jsx` causato da parentesi mancante in `addSection`.
- 2026-05-26: Migliorato `App.jsx`: struttura interna più chiara, editor manuale completo, AI applicativa e preview più leggibile.
- 2026-05-26: Creati/preparati componenti modulari `EditorView.jsx`, `DocumentPreview.jsx`, `CollectionView.jsx` e aggiornati `Layout`, `Topbar`, `Icon`; import statici non compatibili col runner.
- 2026-05-26: Ripristinato `App.jsx` self-contained per preview stabile; README e DESIGN aggiornati con nota su migrazione modulare futura.
- 2026-05-26: Corretto errore runtime “Identifier 'Topbar' has already been declared” rinominando il componente interno in `AppTopbar`; preview e verifica ok.
- 2026-05-26: Aggiunto template/preventivo “sito web per Francesca” e comando AI dedicato; preview e verifica ok.