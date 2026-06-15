import React from 'react';
import { money } from '../constants.js';

export default function AuthorQuoteTemplate({ client, date, styleId }) {
  const options = [
    {
      id: 1,
      title: "OPZIONE 1 — Sito Vetrina WordPress · Con Manutenzione",
      description: "Sito vetrina professionale realizzato con WordPress, comprensivo di: pagina \"Chi sei\", sezione libri pubblicati con foto e descrizione, link ai social, ottimizzazione SEO base.",
      oneTimeCost: 750,
      monthlyCost: 50,
      includesMaintenance: true
    },
    {
      id: 2,
      title: "OPZIONE 2 — Sito Vetrina WordPress · Senza Manutenzione",
      description: "Stessa realizzazione dell'Opzione 1. Dominio e hosting sono a carico della cliente con gestione autonoma.",
      oneTimeCost: 950,
      monthlyCost: 0,
      includesMaintenance: false
    },
    {
      id: 3,
      title: "OPZIONE 3 — Sito Vetrina su Misura (HTML/CSS/JS) · Con Manutenzione",
      description: "Sito vetrina professionale sviluppato su misura in HTML, CSS e JavaScript. Include: pagina \"Chi sei\", sezione libri con foto e descrizione, link ai social, ottimizzazione SEO base.",
      oneTimeCost: 550,
      monthlyCost: 50,
      includesMaintenance: true
    },
    {
      id: 4,
      title: "OPZIONE 4 — Sito Vetrina su Misura (HTML/CSS/JS) · Senza Manutenzione",
      description: "Stessa realizzazione dell'Opzione 3. Dominio e hosting sono a carico della cliente con gestione autonoma.",
      oneTimeCost: 700,
      monthlyCost: 0,
      includesMaintenance: false
    }
  ];

  const vatRate = 22;

  return (
    <article className={`document style-${styleId || 'standard'}`} style={{ minHeight: 'auto', padding: '40px 50px' }}>
      <div className="doc-topline" />
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ color: 'var(--accent)', fontSize: '2rem', margin: '0 0 10px' }}>PREVENTIVI SITO WEB</h1>
        <p style={{ margin: '5px 0' }}><strong>Cliente:</strong> {client || "_________"}</p>
        <p style={{ margin: '5px 0' }}><strong>Data:</strong> {date || "20 maggio 2026"}</p>
        <p style={{ margin: '5px 0' }}><strong>Preparato da:</strong> Giovanni Cidu</p>
        <p style={{ marginTop: '15px', fontSize: '0.9rem', color: '#46546a' }}>
          Tutti i preventivi includono ottimizzazione SEO base (meta tag, titoli, descrizioni, sitemap).
        </p>
        <p style={{ fontSize: '0.9rem', color: '#46546a' }}>
          Modalità di pagamento: 50% di acconto all'avvio del progetto, saldo entro 30 giorni dalla consegna.
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>COSA INCLUDE IL SITO VETRINA</h2>
        <p style={{ marginBottom: '10px' }}>
          Il sito vetrina proposto consiste in un sito monopagina semplice, progettato per presentare in modo chiaro e professionale l'attività dell'autrice.
        </p>
        <p style={{ marginBottom: '8px' }}><strong>Include:</strong></p>
        <ul style={{ paddingLeft: '20px', margin: '0' }}>
          <li>Sezione Chi sei — testo di presentazione, foto profilo, bio breve.</li>
          <li>Sezione Libri — griglia con copertina, titolo, anno, breve descrizione e link ad Amazon/store per l'acquisto (se fornito).</li>
          <li>Sezione Social — icone cliccabili verso i profili social.</li>
          <li>Header — nome/logo e menu di navigazione interno.</li>
          <li>Footer — contatti e copyright.</li>
          <li>Ottimizzazione mobile — visualizzazione corretta su smartphone e tablet.</li>
        </ul>
      </div>

      {options.map(option => {
        const oneTimeVat = option.oneTimeCost * vatRate / 100;
        const oneTimeTotal = option.oneTimeCost + oneTimeVat;
        const monthlyVat = option.monthlyCost * vatRate / 100;
        const monthlyTotal = option.monthlyCost + monthlyVat;

        return (
          <div key={option.id} style={{ marginBottom: '40px', padding: '20px', border: '1px solid #e0e5ee', borderRadius: '14px', background: '#f8fafd' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--accent)' }}>{option.title}</h2>
            <p style={{ marginBottom: '15px' }}><strong>Descrizione del progetto</strong></p>
            <p style={{ marginBottom: '15px' }}>{option.description}</p>
            <p style={{ marginBottom: '10px' }}><strong>Costi</strong></p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0' }}>Sviluppo sito (una tantum)</td>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>{money(option.oneTimeCost)}</td>
                </tr>
                {option.includesMaintenance ? (
                  <>
                    <tr>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0' }}>Dominio (.it o .com, 1 anno)</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>incluso nella manutenzione</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0' }}>Hosting (1 anno)</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>incluso nella manutenzione</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0' }}>Manutenzione mensile</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>{money(option.monthlyCost)}/mese</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0' }}>Dominio (a carico cliente — indicativo)</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>~€15–20/anno</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0' }}>Hosting (a carico cliente — indicativo)</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>~€60–120/anno</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            <p style={{ marginBottom: '10px' }}><strong>Riepilogo economico</strong></p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 0', borderBottom: '2px solid #d8deea' }}>Voce</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', borderBottom: '2px solid #d8deea' }}>Imponibile</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', borderBottom: '2px solid #d8deea' }}>IVA 22%</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', borderBottom: '2px solid #d8deea' }}>Totale IVA inclusa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid #e4e8f0' }}>Sviluppo (una tantum)</td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>{money(option.oneTimeCost)}</td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>{money(oneTimeVat)}</td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid #e4e8f0', textAlign: 'right' }}>{money(oneTimeTotal)}</td>
                </tr>
                {option.includesMaintenance && (
                  <tr>
                    <td style={{ padding: '12px 0' }}>Manutenzione mensile</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>{money(option.monthlyCost)}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>{money(monthlyVat)}</td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>{money(monthlyTotal)}/mese</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p style={{ marginTop: '15px', fontSize: '0.95rem', fontWeight: 'bold' }}>
              Acconto (50%): {money(oneTimeTotal / 2)} IVA inclusa · Saldo: {money(oneTimeTotal / 2)} entro 30 giorni dalla consegna
            </p>
          </div>
        );
      })}

      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #d7deea' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>CLAUSOLE E CONDIZIONI GENERALI</h2>
        <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
          <p><strong>Fornitura materiali</strong><br />
          La cliente si impegna a fornire tutti i contenuti necessari alla realizzazione del sito (testi, foto, descrizioni dei libri, loghi, link social) entro 7 giorni lavorativi dall'avvio del progetto. Eventuali ritardi nella fornitura dei materiali comporteranno uno slittamento proporzionale della data di consegna stimata, senza responsabilità da parte dello sviluppatore.</p>
          
          <p><strong>Consegna stimata</strong><br />
          La consegna del sito è stimata entro 3–4 settimane dalla ricezione di tutti i materiali e del pagamento dell'acconto. I tempi possono variare in caso di richieste aggiuntive rispetto a quanto concordato.</p>
          
          <p><strong>Revisioni incluse</strong><br />
          Il preventivo include 2 round di revisione su grafica e contenuti durante la fase di sviluppo. Ulteriori modifiche richieste prima della consegna saranno quotate separatamente.</p>
          
          <p><strong>Proprietà del sito</strong><br />
          Il sito e tutti i suoi elementi diventeranno di piena proprietà della cliente solo a saldo completato. In caso di mancato pagamento entro i termini, lo sviluppatore si riserva il diritto di non pubblicare o di sospendere il sito.</p>
        </div>
      </div>

      <footer className="doc-foot" style={{ marginTop: '40px' }}>
        <span>Giovanni Cidu • Soluzioni Digitali</span>
        <span>Preventivo valido 30 giorni</span>
      </footer>
    </article>
  );
}
