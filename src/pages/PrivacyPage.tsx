import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPage.css';

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-page__inner">
        <h1>Privacy Policy</h1>
        <p className="privacy-page__updated">Ultimo aggiornamento: 16 agosto 2026</p>

        <section>
          <h2>1. Titolare del trattamento</h2>
          <p>
            Quickbrand — Giovanni Cidu, Cagliari, Italia. Contatto:{' '}
            <a href="mailto:info@quickbrand.it">info@quickbrand.it</a>.
          </p>
        </section>

        <section>
          <h2>2. Dati raccolti</h2>
          <p>Raccogliamo solo i dati necessari al servizio:</p>
          <ul>
            <li><strong>Account</strong>: email e password (hash bcrypt) per l'accesso.</li>
            <li><strong>Contenuti</strong>: preventivi, QR, card, loghi, flyer, siti e dati dei clienti inseriti nell'app.</li>
            <li><strong>Form intake</strong>: nome attività, referente, contatti e risposte al brief (solo se usi il modulo).</li>
            <li><strong>Dati tecnici</strong>: log di errore anonimi (endpoint, timestamp) per il debug.</li>
          </ul>
          <p>Non raccogliamo dati di navigazione, cookie di profilazione o dati di terze parti.</p>
        </section>

        <section>
          <h2>3. Cookie e storage locale</h2>
          <p>
            L'app usa <strong>solo cookie tecnici</strong> (sessione di autenticazione) e{' '}
            <strong>localStorage</strong> per salvare i tuoi documenti in locale durante lo sviluppo.
            Nessun cookie di profilazione, nessun tracciamento di terze parti. Puoi rifiutare il
            consenso: l'app continua a funzionare, i dati restano solo sul tuo dispositivo.
          </p>
        </section>

        <section>
          <h2>4. Finalità e base giuridica</h2>
          <p>
            I dati sono trattati per erogare il servizio (esecuzione del contratto, art. 6.1.b GDPR)
            e per adempiere obblighi di legge. Non vendiamo né cediamo i tuoi dati a terzi.
          </p>
        </section>

        <section>
          <h2>5. Conservazione</h2>
          <p>
            I dati sono conservati per la durata del rapporto e cancellati su richiesta. I documenti
            in locale (localStorage) sono eliminabili cancellando i dati del browser.
          </p>
        </section>

        <section>
          <h2>6. I tuoi diritti</h2>
          <p>
            Puoi esercitare i diritti GDPR (accesso, rettifica, cancellazione, portabilità,
            opposizione) scrivendo a <a href="mailto:info@quickbrand.it">info@quickbrand.it</a>.
            Hai diritto di reclamo al Garante per la protezione dei dati personali.
          </p>
        </section>

        <p className="privacy-page__back">
          <Link to="/">← Torna alla home</Link>
        </p>
      </div>
    </div>
  );
}
