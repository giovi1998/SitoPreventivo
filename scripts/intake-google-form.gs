/**
 * Quickbrand — Google Form intake (bootstrap + webhook).
 *
 * In un nuovo progetto Apps Script (https://script.new), incolla questo file.
 * 1) Esegui createIntakeForm() una volta (autorizza) → crea form + Sheet + trigger.
 * 2) Ogni risposta al form scatena onFormSubmit → POST /api/intake (upsert).
 * 3) Per correggere una riga già inviata: esegui aggiornaRiga(N) dal dropdown.
 * 4) In caso di problemi usa testWebhook() per isolare la catena.
 */

const WEBHOOK_URL = 'https://quickbrand.vercel.app/api/intake';

/**
 * Mapping indice colonna Sheet (0 = Timestamp auto, colonna A) → campo JSON.
 * L'ordine degli addItem in createIntakeForm() DEVE restare in sync con COL.
 * Le colonne delle domande saltate dal branching restano vuote nel payload.
 */
const COL = {
  businessName: 1,
  ownerName: 2,
  sector: 3,
  activity: 4,
  mood: 5,
  target: 6,
  preferredColors: 7,
  email: 8,
  phone: 9,
  address: 10,
  hasWebsite: 11,
  website: 12,
  wantsPage: 13,
  headline: 14,
  offer: 15,
  cta: 16,
  tone: 17,
  package: 18,
};

function createIntakeForm() {
  const form = FormApp.create('Quickbrand — Brief attività');
  form.setDescription(
    'Raccontaci la tua attività: prepariamo logo, biglietti da visita, volantino e social in 3 giorni. Compila i campi che ti riguardano.'
  );
  form.setConfirmationMessage('Grazie! Ti ricontattiamo entro 24 ore.');
  form.setAllowResponseEdits(false);
  form.setCollectEmail(false);

  // --- Sezione 1: informazioni attività ---
  form.addPageBreakItem().setTitle('Le tue informazioni');
  form.addTextItem().setTitle('Nome attività').setRequired(true);
  form.addTextItem().setTitle('Referente');
  form.addTextItem().setTitle('Settore').setHelpText('Es. ristorante, bar, b&b, salone, negozio');
  form.addParagraphTextItem().setTitle('Descrizione attività')
    .setHelpText('Cosa fai, come lavori, cosa offri ai clienti');
  form.addTextItem().setTitle('Stile / atmosfera')
    .setHelpText('Come vuoi che appaia il tuo brand. Es. minimal, moderno, caldo, elegante');
  form.addParagraphTextItem().setTitle('Target')
    .setHelpText('Chi sono i tuoi clienti ideali? Es. famiglie, giovani, turisti');
  form.addTextItem().setTitle('Colori preferiti')
    .setHelpText('Es. blu, bianco, legno');
  form.addTextItem().setTitle('Email').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addTextItem().setTitle('Telefono');
  form.addTextItem().setTitle('Indirizzo');

  // --- Sezione 2: sito web (branching Sì → URL, No → landing) ---
  const pageSite = form.addPageBreakItem().setTitle('Sito web');
  const siteChoice = form.addMultipleChoiceItem().setTitle('Hai già un sito web?')
    .setHelpText('Se sì, lo analizziamo per ricavare colori e contenuti (opzionale)');

  // --- Sezione 3: URL del sito ---
  const pageUrl = form.addPageBreakItem().setTitle('URL del sito');
  form.addTextItem().setTitle('URL del sito web')
    .setHelpText('Es. https://www.miosito.it');

  // --- Sezione 4: landing page + pacchetto ---
  const pageLanding = form.addPageBreakItem().setTitle('Vuoi anche una pagina web?');
  form.addMultipleChoiceItem().setTitle('Vorresti una pagina web di presentazione per la tua attività?')
    .setChoiceValues(['Sì', 'No']);
  form.addTextItem().setTitle('Testo principale / slogan')
    .setHelpText('Es. "La miglior cucina sarda a Cagliari"');
  form.addParagraphTextItem().setTitle('Cosa offri in breve')
    .setHelpText('Es. menù degustazione, eventi, catering');
  form.addTextItem().setTitle('Bottone principale (CTA)')
    .setHelpText('Es. Prenota ora, Chiama, WhatsApp');
  form.addTextItem().setTitle('Tono della pagina')
    .setHelpText('Es. professionale, friendly, elegante');
  form.addListItem().setTitle('Pacchetto')
    .setChoiceValues(['apertura', 'presenza', 'custom']);

  // Branching: Sì → sezione URL, No → salta a sezione landing.
  // ATTENZIONE: usare `item.createChoice(...)` (istanza), NON FormApp.createChoice:
  // in questo runtime `FormApp.createChoice` non esiste ("is not a function",
  // errore già visto 2 volte — gotcha). item.createChoice(value, pageItem) è
  // l'API corretta per il go-to-section.
  siteChoice.setChoices([
    siteChoice.createChoice('Sì', pageUrl),
    siteChoice.createChoice('No', pageLanding),
  ]);

  const sheet = SpreadsheetApp.create('Quickbrand — Brief attività (risposte)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(sheet.getId()).onFormSubmit().create();

  // I form creati via FormApp.create NON sono pubblici di default: senza
  // condivisione chi apre il link vede "Non condiviso" e serve login con
  // account autorizzato. Rendiamoli "chiunque con il link" (nessun login).
  makeFormPublic(form.getId());

  Logger.log('Form: ' + form.getPublishedUrl());
  Logger.log('Risposte: ' + sheet.getUrl());
  Logger.log('Test: invia 1 risposta e verifica il record in CRM.');
}

/**
 * Rende un form pubblico: chiunque abbia il link può rispondere senza login.
 * Usata da createIntakeForm() e da makeQuickbrandFormPublic() (fix form esistenti).
 */
function makeFormPublic(formId) {
  const file = DriveApp.getFileById(formId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('Form reso pubblico (chiunque con il link).');
}

/**
 * Fix per il form già creato: cerca 'Quickbrand — Brief attività' e lo rende
 * pubblico. Esegui UNA volta dal dropdown, poi verifica col link pubblicato.
 */
function makeQuickbrandFormPublic() {
  const files = DriveApp.getFilesByName('Quickbrand — Brief attività');
  if (!files.hasNext()) {
    Logger.log('Nessun form trovato con nome "Quickbrand — Brief attività".');
    return;
  }
  makeFormPublic(files.next().getId());
}

/**
 * Ricollega il form ESISTENTE a un nuovo Sheet risposte + ricrea il trigger
 * onFormSubmit. Da usare se il Sheet "Quickbrand — Brief attività (risposte)"
 * è stato cancellato/rotto (senza trigger il webhook non parte più).
 * NON crea un form duplicato. Esegui dopo aver incollato la versione nuova.
 */
function reconnectFormSheet() {
  const files = DriveApp.getFilesByName('Quickbrand — Brief attività');
  if (!files.hasNext()) {
    Logger.log('Nessun form trovato con nome "Quickbrand — Brief attività". Esegui createIntakeForm().');
    return;
  }
  const form = FormApp.openById(files.next().getId());
  const sheet = SpreadsheetApp.create('Quickbrand — Brief attività (risposte)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(sheet.getId()).onFormSubmit().create();
  makeFormPublic(form.getId());
  Logger.log('Ricollegato! Form: ' + form.getPublishedUrl());
  Logger.log('Risposte: ' + sheet.getUrl());
}

/**
 * Invia un payload a /api/intake e logga il risultato.
 * L'endpoint upserta: se sourceRef esiste → UPDATE, altrimenti INSERT.
 * 200/201 = ok. 400/429/500 = errore.
 */
function sendToWebhook(payload) {
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  // SEC-001: nessun PII nel log (solo sourceRef + status code)
  Logger.log('[intake] %s -> %s', payload.sourceRef, code);
  if (code >= 400) {
    Logger.log('[intake] body: %s', response.getContentText().slice(0, 300));
  }
  return response;
}

function onFormSubmit(e) {
  const payload = buildIntakePayload(e.values, e.range.getRow());
  sendToWebhook(payload);
}

function buildIntakePayload(values, row) {
  const pick = (index) => values[index] || undefined;
  return {
    businessName: pick(COL.businessName),
    ownerName: pick(COL.ownerName),
    sector: pick(COL.sector),
    activity: pick(COL.activity),
    mood: pick(COL.mood),
    target: pick(COL.target),
    preferredColors: pick(COL.preferredColors),
    contacts: {
      email: pick(COL.email),
      phone: pick(COL.phone),
      address: pick(COL.address),
      website: pick(COL.website),
    },
    webAnswers: {
      wantsPage: pick(COL.wantsPage),
      headline: pick(COL.headline),
      offer: pick(COL.offer),
      cta: pick(COL.cta),
      tone: pick(COL.tone),
    },
    package: pick(COL.package) || 'apertura',
    sourceRef: 'sheet_row_' + row,
  };
}

/**
 * Diagnostica: invia un payload valido a /api/intake e logga code + body.
 * 200/201 = catena webhook→DB ok. 400/429/500 = errore lato server.
 * Utile se onFormSubmit non produce record in CRM.
 */
function testWebhook() {
  const payload = {
    businessName: 'Test ' + new Date().toISOString().slice(0, 10),
    ownerName: 'Tester',
    sector: 'test',
    contacts: { email: 'test@example.com', website: '' },
    webAnswers: { wantsPage: 'No' },
    package: 'apertura',
    sourceRef: 'test_' + new Date().getTime(),
  };
  sendToWebhook(payload);
}

/**
 * Re-invia manualmente una riga del foglio risposte al webhook.
 * L'endpoint upserta: se sourceRef esiste → UPDATE (non più 409).
 * Serve per recuperare risposte fallite (400/429) DOPO un fix lato server,
 * o per aggiornare un brief dopo una correzione manuale nel foglio.
 * - senza argomento → re-invia l'ULTIMA riga (la più recente);
 * - con argomento N → re-invia la riga N (N≥2, la 1 è l'header).
 * 200/201 = ok. 400/429/500 = errore lato server, body loggato.
 * NOTA: NON lanciare onFormSubmit a mano — è un trigger che richiede
 * l'evento `e`; per i test manuali usa questa funzione.
 */
function resendRowToWebhook(row) {
  const sheet = getIntakeSheet();
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Nessuna risposta da inviare.'); return; }
  const target = row != null && row !== '' ? Number(row) : lastRow;
  if (target < 2 || target > lastRow) {
    Logger.log('Riga fuori range (2..' + lastRow + ').');
    return;
  }
  const values = sheet.getRange(target, 1, 1, sheet.getLastColumn()).getValues()[0];
  const payload = buildIntakePayload(values, target);
  sendToWebhook(payload);
}

/**
 * Aggiorna una riga del foglio risposte sul server (upsert by sourceRef).
 * Usala dopo aver corretto manualmente una riga nel foglio:
 * esegui `aggiornaRiga(N)` dal dropdown, dove N è il numero riga.
 * L'endpoint /api/intake aggiorna il record esistente (stesso sourceRef).
 */
function aggiornaRiga(row) {
  resendRowToWebhook(row);
}

/**
 * Restituisce il foglio risposte attivo, o null se non trovato.
 */
function getIntakeSheet() {
  const files = DriveApp.getFilesByName('Quickbrand — Brief attività (risposte)');
  if (!files.hasNext()) { Logger.log('Sheet risposte non trovato. Esegui reconnectFormSheet().'); return null; }
  return SpreadsheetApp.openById(files.next().getId()).getSheets()[0];
}
