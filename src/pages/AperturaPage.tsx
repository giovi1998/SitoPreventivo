import React from 'react';
import { Link } from 'react-router-dom';
import './AperturaPage.css';

const CONTACT_URL = 'https://docs.google.com/forms/d/13GRmeh9ZYQPOIJmDahF1pLTGmkH4XOoC0nCXOb_NGOo/edit';

const INCLUDED = [
  { title: 'Logo', desc: 'Logo SVG vettoriale, pronto per stampa e digitale.' },
  { title: 'Biglietti da visita', desc: '250 biglietti stampati, fronte e retro coordinati.' },
  { title: '250 volantini stampati', desc: 'Formato A5, pronti da distribuire all\'apertura.' },
  { title: 'Sito 1 pagina', desc: 'Landing con contatti, mappa e CTA. Hosting incluso.' },
  { title: 'Post social', desc: '3 grafiche coordinate per annunciare l\'apertura.' },
  { title: 'File pronti per la tipografia', desc: 'PDF 300 DPI e PNG web, senza watermark.' },
];

const STEPS = [
  { n: '1', title: 'Compili il brief', desc: 'Nome, settore, colori, contatti. 10 minuti.' },
  { n: '2', title: 'L\'AI genera le bozze', desc: 'Logo, card, volantino e sito in un colpo solo.' },
  { n: '3', title: 'Rifinisci con noi', desc: '1 round di revisione incluso, fino a 3 giorni.' },
  { n: '4', title: 'Stampa e consegna', desc: 'Volantini e biglietti stampati, consegnati a Cagliari.' },
];

const FAQ = [
  { q: 'In quanto tempo consegnate?', a: '3 giorni lavorativi dalla conferma del brief. Se hai una data di apertura, pianifichiamo al contrario.' },
  { q: 'Quante revisioni sono incluse?', a: '1 round di revisione incluso. Revisioni extra si concordano a parte.' },
  { q: 'E se non mi piace il risultato?', a: 'Rimborso fino al 50% se non sei soddisfatto (esclusi stampa e dominio già acquistati).' },
  { q: 'Come pago?', a: 'Pagamento gestito personalmente via email, prima della consegna. Nessun abbonamento.' },
  { q: 'Il sito è incluso davvero?', a: 'Sì: landing 1 pagina con contatti, mappa e CTA, hosting incluso per il primo anno.' },
];

export default function AperturaPage() {
  return (
    <div className="ap">
      <header className="ap-header">
        <div className="ap-header-inner">
          <Link to="/" className="ap-brand">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#E62020" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Quickbrand</span>
          </Link>
          <a href={CONTACT_URL} className="ap-btn-primary">Richiedi il pacchetto</a>
        </div>
      </header>

      <section className="ap-hero">
        <p className="ap-eyebrow">Pacchetto Apertura · €349 una tantum</p>
        <h1 className="ap-h1">
          Apri la tua attività.<br />
          <span className="ap-h1-accent">Noi ti facciamo il brand in 3 giorni.</span>
        </h1>
        <p className="ap-sub">
          Logo, biglietti da visita, 250 volantini stampati e sito 1 pagina.
          Tutto coordinato, tutto incluso, consegna in 3 giorni lavorativi.
        </p>
        <div className="ap-cta-row">
          <a href={CONTACT_URL} className="ap-cta">Richiedi il pacchetto →</a>
          <a href="#incluso" className="ap-cta-ghost">Cosa include</a>
        </div>
        <p className="ap-hero-foot">Nessun abbonamento · 1 revisione inclusa · Rimborso fino al 50%</p>
      </section>

      <section className="ap-section" id="incluso">
        <h2 className="ap-section-h">Tutto incluso, niente da aggiungere.</h2>
        <p className="ap-section-sub">
          Un'agenzia chiede €2.500-8.000 e 2-4 settimane. Quickbrand consegna
          il kit completo in 3 giorni, a prezzo fisso.
        </p>
        <div className="ap-grid">
          {INCLUDED.map((item) => (
            <article key={item.title} className="ap-card">
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ap-section ap-section--dark">
        <h2 className="ap-section-h">Come funziona</h2>
        <div className="ap-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="ap-step">
              <span className="ap-step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ap-section">
        <h2 className="ap-section-h">Domande frequenti</h2>
        <div className="ap-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="ap-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="ap-final-cta">
        <h2>Hai una data di apertura?</h2>
        <p>Pianifichiamo al contrario: brand pronto prima del grande giorno.</p>
        <a href={CONTACT_URL} className="ap-cta">Richiedi il pacchetto →</a>
      </section>

      <footer className="ap-footer">
        <p>© 2026 Quickbrand · Giovanni Cidu</p>
        <p className="ap-footer-small"><Link to="/privacy">Privacy Policy</Link></p>
      </footer>
    </div>
  );
}
