import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import '../components/CardEditor.css';
import { createGiovanniCardTemplate } from '../utils/documentSchemas';
import type { Tier } from '../utils/watermark';

interface HomePageProps {
  user: any;
}

const giovanniCard = createGiovanniCardTemplate();

export default function HomePage({ user }: HomePageProps) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  return (
    <div className="hp">
      <header className="hp-header">
        <div className="hp-header-inner">
          <div className="hp-brand">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#0B57D0" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>PrecisionQuote</span>
          </div>
          <nav className="hp-nav">
            {user ? (
              <Link to="/app" className="hp-btn-primary">Vai all'App</Link>
            ) : (
              <>
                <Link to="/login" className="hp-btn-ghost">Accedi</Link>
                <Link to="/login?register=1" className="hp-btn-primary">Registrati</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="hp-hero">
        <div className="hp-hero-inner">
          <p className="hp-eyebrow">Preventivi · Biglietti · QR · Logo</p>
          <h1 className="hp-h1">
            Tutto quello che serve<br />
            per la tua attività,<br />
            <span className="hp-h1-accent">pronto in 3 giorni.</span>
          </h1>
          <p className="hp-sub">
            Crea preventivi professionali, biglietti da visita, QR code e logo
            direttamente dal browser. Gratis per sempre. Sblocca watermark e
            stampe solo quando ti servono.
          </p>
          <div className="hp-cta-row">
            {user ? (
              <Link to="/app" className="hp-cta">Vai all'App →</Link>
            ) : (
              <Link to="/login?register=1" className="hp-cta">Inizia gratis →</Link>
            )}
            <a href="#pricing" className="hp-cta-ghost">Vedi i pacchetti</a>
          </div>
          <p className="hp-hero-foot">Nessuna carta di credito · Prova senza limiti di tempo</p>
        </div>
      </section>

      {/* ─── Cosa puoi creare ─────────────────────────────── */}
      <section className="hp-section">
        <h2 className="hp-section-h">Cosa puoi creare</h2>
        <div className="hp-create-grid">
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            </div>
            <h3>Preventivi multi-opzione</h3>
            <p>Fino a 4 opzioni per preventivo, con costi una tantum e mensili, IVA, acconto, saldo e clausole. Esporta in PDF professionale.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="4" x2="8" y2="10"/></svg>
            </div>
            <h3>Biglietti da visita</h3>
            <p>Layout split, centrato o sinistro. Foto, logo, QR code sul retro con contatti e social. Esporta SVG, PNG ad alta risoluzione o PDF pronto tipografia.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </div>
            <h3>QR Code</h3>
            <p>7 tipi: URL, testo, email, telefono, vCard, WiFi, SMS. Stili square, rounded o dots. Logo overlay opzionale. Export SVG vettoriale.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/></svg>
            </div>
            <h3>Logo SVG</h3>
            <p>Builder con 4 template per settore (tech, food, fashion, professionista), 3 layout, 48 icone lucide. Esporta SVG editabile o PNG fino a 2048px.</p>
          </article>
        </div>
      </section>

      {/* ─── Card demo flip 3D ────────────────────────────── */}
      <section className="hp-section hp-demo-section">
        <h2 className="hp-section-h">Gratis con watermark. Sbloccata, pulita.</h2>
        <p className="hp-section-sub">
          Tocca o passa il mouse sulla card per vedere la differenza.
        </p>

        <div
          className={`hp-flip ${flipped ? 'is-flipped' : ''}`}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
          role="button"
          tabIndex={0}
          aria-label="Demo card: clicca o tocca per vedere la versione sbloccata senza watermark"
          aria-pressed={flipped}
        >
          <div className="hp-flip-inner">
            <div className="hp-flip-face hp-flip-front">
              <div className="hp-card-scale">
                <CardPreview side="front" card={giovanniCard} tier="free" />
              </div>
              <svg className="hp-watermark-overlay" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <pattern id="hp-wm-front" patternUnits="userSpaceOnUse" width="220" height="90" patternTransform="rotate(-30)">
                    <text x="0" y="40" textAnchor="start" fontFamily="Helvetica, Arial, sans-serif" fontSize="20" fontWeight="700" fill="#0B57D0" fillOpacity="0.13" letterSpacing="1.5">PRECISIONQUOTE · FREE</text>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hp-wm-front)" />
              </svg>
              <span className="hp-tier-tag" data-tier="free">FREE · watermark attivo</span>
            </div>
            <div className="hp-flip-face hp-flip-back">
              <div className="hp-card-scale">
                <CardPreview side="back" card={giovanniCard} tier="unlocked" />
              </div>
              <span className="hp-tier-tag" data-tier="unlocked">SBLOCCATO · 300 DPI · no watermark</span>
            </div>
          </div>
        </div>

        <p className="hp-demo-hint">
          {flipped ? '◀ Torna al fronte (Free)' : 'Vai al retro (Sbloccato) ▶'}
        </p>
      </section>

      {/* ─── Come funziona ────────────────────────────────── */}
      <section className="hp-section hp-steps-section">
        <h2 className="hp-section-h">Come funziona</h2>
        <ol className="hp-steps">
          <li className="hp-step">
            <span className="hp-step-num">1</span>
            <h3>Registrati gratis</h3>
            <p>Crea un account in 30 secondi. Nessuna carta richiesta. Parti subito con 3 documenti.</p>
          </li>
          <li className="hp-step">
            <span className="hp-step-num">2</span>
            <h3>Crea il tuo materiale</h3>
            <p>Usa l'editor visivo o l'AI integrata per generare biglietti, QR, logo e preventivi. Preview live in tempo reale.</p>
          </li>
          <li className="hp-step">
            <span className="hp-step-num">3</span>
            <h3>Esporta o sblocca</h3>
            <p>Esporta gratis con watermark, oppure riscatta un codice pacchetto per rimuovere il watermark e avere tutto illimitato.</p>
          </li>
        </ol>
      </section>

      {/* ─── Pricing — Subscription mensile ──────────────── */}
      <section className="hp-section hp-pricing-section" id="pricing">
        <h2 className="hp-section-h">Piano mensile</h2>
        <p className="hp-section-sub">
          L'AI ha un costo reale a token. Il piano <strong>Pro</strong> copre
          l'AI che usi e rimuove il watermark da tutti i tuoi documenti.
        </p>

        <div className="hp-pricing-grid">
          <div className="hp-price-card">
            <h3>Free</h3>
            <div className="hp-price"><span>€0</span><small>per sempre</small></div>
            <ul>
              <li>3 documenti salvati</li>
              <li>Watermark su export e preview</li>
              <li>150 DPI PDF · 72 DPI PNG</li>
              <li>AI: 0 prompt/mese</li>
            </ul>
            {user ? (
              <Link to="/app" className="hp-price-cta">Vai all'App</Link>
            ) : (
              <Link to="/login?register=1" className="hp-price-cta">Inizia gratis</Link>
            )}
          </div>

          <div className="hp-price-card hp-price-featured">
            <div className="hp-price-badge">Per chi usa l'app</div>
            <h3>Pro</h3>
            <div className="hp-price"><span>€9</span><small>/mese</small></div>
            <ul>
              <li>Documenti illimitati</li>
              <li>No watermark su export e preview</li>
              <li>300 DPI PDF · 4096px PNG</li>
              <li>AI: 1.000 prompt/mese inclusi</li>
              <li>Quota extra AI: €0.01/prompt</li>
              <li>Cancella quando vuoi</li>
            </ul>
            <a href="mailto:webdevcagliari@gmail.com?subject=Pro%20%E2%82%AC9%2Fmese" className="hp-price-cta">Attiva Pro</a>
          </div>
        </div>

        <h2 className="hp-section-h hp-section-h-secondary">Pacchetti una tantum</h2>
        <p className="hp-section-sub">
          Per chi preferisce pagare una volta sola, senza abbonamento.
          Sblocco permanente, niente AI mensile.
        </p>

        <div className="hp-pricing-grid">
          <div className="hp-price-card">
            <h3>Starter</h3>
            <div className="hp-price"><span>€49</span><small>una tantum</small></div>
            <ul>
              <li>Documenti illimitati</li>
              <li>No watermark</li>
              <li>300 DPI export</li>
              <li>Senza AI (acquistabile a parte)</li>
            </ul>
            <a href="mailto:webdevcagliari@gmail.com?subject=Starter%20%E2%82%AC49" className="hp-price-cta">Contattaci</a>
          </div>

          <div className="hp-price-card">
            <h3>Apertura</h3>
            <div className="hp-price"><span>€349</span><small>una tantum</small></div>
            <ul>
              <li>Tutto di Starter</li>
              <li>250 volantini stampati</li>
              <li>Sito 1 pagina o landing</li>
              <li>Consegna 3 giorni</li>
            </ul>
            <a href="mailto:webdevcagliari@gmail.com?subject=Apertura%20%E2%82%AC349" className="hp-price-cta">Contattaci</a>
          </div>

          <div className="hp-price-card">
            <h3>Presenza</h3>
            <div className="hp-price"><span>€690</span><small>una tantum</small></div>
            <ul>
              <li>Tutto di Apertura</li>
              <li>Sito 3-5 pagine</li>
              <li>Google My Business</li>
              <li>3 grafiche social</li>
            </ul>
            <a href="mailto:webdevcagliari@gmail.com?subject=Presenza%20%E2%82%AC690" className="hp-price-cta">Contattaci</a>
          </div>
        </div>

        <p className="hp-pricing-note">
          Manutenzione mensile <strong>€49/mese</strong>: aggiornamenti sito, 1-2 grafiche, hosting gestito.
          Confronto mercato: un'agenzia chiede €2.500-8.000 solo per il sito, con 2-4 settimane di attesa.
        </p>
      </section>

      {/* ─── CTA finale ───────────────────────────────────── */}
      <section className="hp-final-cta">
        <h2>Inizia ora, gratis.</h2>
        <p>Crea il tuo primo preventivo o biglietto in 5 minuti.</p>
        {user ? (
          <Link to="/app" className="hp-cta">Vai all'App →</Link>
        ) : (
          <Link to="/login?register=1" className="hp-cta">Registrati gratis →</Link>
        )}
      </section>

      <footer className="hp-footer">
        <p>© 2026 PrecisionQuote · Giovanni Cidu</p>
        <p className="hp-footer-small">Pagamenti gestiti personalmente via email · Cagliari, Italia</p>
      </footer>

      <style>{`
        .hp{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#07111f;background:#fafbfc;min-height:100vh;-webkit-font-smoothing:antialiased}
        [data-theme="dark"] .hp{color:#e8eaf0;background:#0f1117}

        /* ─── Header ──────────────────────────────────── */
        .hp-header{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.88);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}
        [data-theme="dark"] .hp-header{background:rgba(15,17,23,.88);border-bottom-color:#2d3044}
        .hp-header-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 24px}
        .hp-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem}
        .hp-nav{display:flex;gap:10px}
        .hp-btn-ghost{padding:8px 16px;border-radius:10px;font-weight:600;font-size:.88rem;color:#0B57D0;text-decoration:none;transition:background .15s}
        .hp-btn-ghost:hover{background:#e8f0fe}
        [data-theme="dark"] .hp-btn-ghost{color:#4d94ff}
        [data-theme="dark"] .hp-btn-ghost:hover{background:rgba(77,148,255,.1)}
        .hp-btn-primary{padding:8px 16px;border-radius:10px;font-weight:600;font-size:.88rem;color:#fff;background:#0B57D0;text-decoration:none;transition:box-shadow .15s,transform .1s}
        .hp-btn-primary:hover{box-shadow:0 4px 12px rgba(11,87,208,.3);transform:translateY(-1px)}

        /* ─── Hero ────────────────────────────────────── */
        .hp-hero{padding:80px 24px 64px;text-align:center}
        .hp-hero-inner{max-width:680px;margin:0 auto}
        .hp-eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0B57D0;margin:0 0 20px}
        [data-theme="dark"] .hp-eyebrow{color:#4d94ff}
        .hp-h1{font-size:clamp(2rem,5.5vw,3.2rem);font-weight:900;letter-spacing:-.035em;line-height:1.1;margin:0 0 24px;color:#07111f}
        [data-theme="dark"] .hp-h1{color:#e8eaf0}
        .hp-h1-accent{color:#0B57D0}
        [data-theme="dark"] .hp-h1-accent{color:#4d94ff}
        .hp-sub{font-size:1.1rem;color:#475569;line-height:1.6;margin:0 0 32px}
        [data-theme="dark"] .hp-sub{color:#8892a8}
        .hp-cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
        .hp-cta{display:inline-block;padding:14px 32px;background:#0B57D0;color:#fff;border-radius:12px;font-weight:700;font-size:1.02rem;text-decoration:none;transition:transform .15s,box-shadow .2s}
        .hp-cta:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(11,87,208,.35)}
        .hp-cta-ghost{display:inline-block;padding:14px 28px;color:#0B57D0;border:1px solid #c7d2e0;border-radius:12px;font-weight:600;font-size:1.02rem;text-decoration:none;transition:border-color .15s,background .15s}
        .hp-cta-ghost:hover{border-color:#0B57D0;background:#f0f6ff}
        [data-theme="dark"] .hp-cta-ghost{color:#4d94ff;border-color:#2d3044}
        [data-theme="dark"] .hp-cta-ghost:hover{border-color:#4d94ff;background:rgba(77,148,255,.06)}
        .hp-hero-foot{font-size:.82rem;color:#94a3b8;margin:0}

        /* ─── Section base ────────────────────────────── */
        .hp-section{max-width:1080px;margin:0 auto;padding:64px 24px}
        .hp-section-h{font-size:clamp(1.6rem,3.5vw,2.1rem);font-weight:900;letter-spacing:-.03em;margin:0 0 16px;text-align:center;color:#07111f}
        .hp-section-h-secondary{margin-top:48px;font-size:clamp(1.3rem,3vw,1.7rem);position:relative}
        .hp-section-h-secondary::before{content:'';display:block;width:40px;height:2px;background:#0B57D0;margin:0 auto 16px;opacity:.4}
        [data-theme="dark"] .hp-section-h{color:#e8eaf0}
        .hp-section-sub{font-size:1rem;color:#647086;text-align:center;max-width:560px;margin:0 auto 40px;line-height:1.55}
        [data-theme="dark"] .hp-section-sub{color:#8892a8}

        /* ─── Cosa puoi creare ────────────────────────── */
        .hp-create-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
        .hp-create-item{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;transition:transform .2s,box-shadow .2s,border-color .2s}
        [data-theme="dark"] .hp-create-item{background:#1a1d27;border-color:#2d3044}
        .hp-create-item:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.06);border-color:#cbd5e0}
        [data-theme="dark"] .hp-create-item:hover{box-shadow:0 8px 24px rgba(0,0,0,.4);border-color:#3d4054}
        .hp-create-icon{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;margin-bottom:14px}
        .hp-create-icon svg{width:22px;height:22px}
        .hp-create-icon[data-color="blue"]{background:#e8f0fe;color:#0B57D0}
        .hp-create-icon[data-color="amber"]{background:#fef3e2;color:#d97706}
        .hp-create-icon[data-color="teal"]{background:#d1f5ec;color:#0d9488}
        .hp-create-icon[data-color="violet"]{background:#ede9fe;color:#7c3aed}
        .hp-create-item h3{font-size:1rem;font-weight:800;margin:0 0 6px}
        .hp-create-item p{font-size:.85rem;color:#647086;line-height:1.5;margin:0}
        [data-theme="dark"] .hp-create-item p{color:#8892a8}

        /* ─── Card flip demo ──────────────────────────── */
        .hp-demo-section{background:linear-gradient(180deg,#f1f5f9 0%,#fafbfc 100%);max-width:none;padding-left:24px;padding-right:24px}
        [data-theme="dark"] .hp-demo-section{background:linear-gradient(180deg,#14161f 0%,#0f1117 100%)}
        .hp-demo-section .hp-section-h,.hp-demo-section .hp-section-sub{position:relative;z-index:1}
        .hp-flip{perspective:1400px;width:min(440px,92vw);margin:0 auto;cursor:pointer;outline:none;aspect-ratio:85/55;position:relative}
        .hp-flip:focus-visible{outline:3px solid #0B57D0;outline-offset:8px;border-radius:14px}
        .hp-flip-inner{position:relative;width:100%;height:100%;transition:transform .8s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}
        .hp-flip.is-flipped .hp-flip-inner{transform:rotateY(180deg)}
        .hp-flip-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:10px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.14)}
        .hp-flip-front{transform:rotateY(0)}
        .hp-flip-back{transform:rotateY(180deg)}
        .hp-card-scale{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
        .hp-card-scale .card-preview-wrap{position:absolute;inset:0;overflow:hidden;display:block;border-radius:0}
        .hp-card-scale .card-preview-side{width:100% !important;height:100% !important;max-width:100% !important;max-height:100% !important;aspect-ratio:85/55 !important;border:none !important;border-radius:0 !important;box-shadow:none !important;display:block}
        /* Front split layout — scale down everything proportionally */
        .hp-card-scale .card-front-split{font-size:0.28em;gap:0}
        .hp-card-scale .card-photo.split{width:100%;height:100%}
        .hp-card-scale .card-front-text{gap:1px}
        .hp-card-scale .card-name{font-size:1em !important;letter-spacing:0.05em !important;white-space:normal !important;line-height:1.05 !important;overflow:visible !important;text-overflow:clip !important}
        .hp-card-scale .card-title{font-size:0.65em !important}
        .hp-card-scale .card-company{font-size:0.6em !important}
        .hp-card-scale .card-split-footer{height:14%}
        .hp-card-scale .card-logo.split{height:100% !important;width:auto !important;max-width:80%}
        /* Back layout — scale the QR down to fit */
        .hp-card-scale .card-preview-back{font-size:0.26em;padding:3% 5% !important;gap:2% !important;display:flex !important;flex-direction:column !important;justify-content:space-between !important}
        .hp-card-scale .card-back-header{font-size:1em !important;margin-bottom:1% !important}
        .hp-card-scale .card-back-eyebrow{font-size:0.85em !important;letter-spacing:0.15em !important}
        .hp-card-scale .card-back-wordmark{font-size:0.78em !important;letter-spacing:0.05em !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hp-card-scale .card-back-body{font-size:1em !important;display:flex !important;flex-direction:row !important;gap:4% !important;flex:1 !important;align-items:center;min-height:0}
        .hp-card-scale .card-back-contacts{font-size:0.78em !important;line-height:1.35 !important;flex:1 !important;min-width:0}
        .hp-card-scale .card-back-line{font-size:1em !important;margin-bottom:0.4em !important}
        .hp-card-scale .card-back-key{font-size:0.7em !important;letter-spacing:0.1em !important;margin-bottom:0.2em !important}
        .hp-card-scale .card-back-val{font-size:1.1em !important}
        .hp-card-scale .card-back-socials{font-size:0.7em !important;line-height:1.3 !important;margin-top:1em !important;letter-spacing:0.05em}
        .hp-card-scale .card-back-qr{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:1%;align-self:center}
        .hp-card-scale .card-back-qr-frame{padding:1.5% !important;border:0.4px solid var(--card-accent) !important;border-radius:0.6% !important}
        .hp-card-scale .card-back-qr-svg{width:8em !important;height:8em !important;display:block}
        .hp-card-scale .card-back-qr-label{font-size:0.7em !important;max-width:none !important;line-height:1.2 !important;opacity:0.78}
        .hp-card-scale .card-back-qr-wordmark-wrap{font-size:0.7em;margin-top:1%}
        .hp-card-scale .card-back-qr-wordmark{font-size:1em !important;letter-spacing:0.05em !important}
        .hp-watermark-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:multiply;user-select:none}
        .hp-tier-tag{position:absolute;bottom:8px;left:8px;padding:4px 10px;border-radius:6px;font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;backdrop-filter:blur(8px);z-index:10;pointer-events:none}
        .hp-tier-tag[data-tier="free"]{background:rgba(11,87,208,.92);color:#fff}
        .hp-tier-tag[data-tier="unlocked"]{background:rgba(16,185,129,.92);color:#fff}
        .hp-demo-hint{text-align:center;font-size:.85rem;color:#647086;margin:24px 0 0;min-height:1.2em}
        [data-theme="dark"] .hp-demo-hint{color:#8892a8}

        /* ─── Steps ───────────────────────────────────── */
        .hp-steps-section{background:#fff;max-width:none;padding-left:24px;padding-right:24px}
        [data-theme="dark"] .hp-steps-section{background:#14161f}
        .hp-steps{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;max-width:1000px;margin-left:auto;margin-right:auto}
        .hp-step{position:relative;padding-left:0}
        .hp-step-num{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#0B57D0;color:#fff;font-weight:800;font-size:1.1rem;margin-bottom:14px}
        .hp-step h3{font-size:1.05rem;font-weight:800;margin:0 0 6px}
        .hp-step p{font-size:.9rem;color:#647086;line-height:1.55;margin:0}
        [data-theme="dark"] .hp-step p{color:#8892a8}

        /* ─── Pricing ─────────────────────────────────── */
        .hp-pricing-section{padding-top:64px;padding-bottom:64px}
        .hp-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;max-width:1080px;margin:0 auto}
        .hp-price-card{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 22px;display:flex;flex-direction:column}
        [data-theme="dark"] .hp-price-card{background:#1a1d27;border-color:#2d3044}
        .hp-price-featured{border-color:transparent;box-shadow:0 0 0 2px #0B57D0,0 10px 28px rgba(11,87,208,.12)}
        [data-theme="dark"] .hp-price-featured{box-shadow:0 0 0 2px #4d94ff,0 10px 28px rgba(77,148,255,.18)}
        .hp-price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#0B57D0;color:#fff;font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:5px 14px;border-radius:100px}
        .hp-price-card h3{font-size:1.15rem;font-weight:800;margin:0 0 8px}
        .hp-price{display:flex;align-items:baseline;gap:6px;margin-bottom:18px}
        .hp-price span{font-size:2.2rem;font-weight:900;color:#07111f;letter-spacing:-.02em}
        [data-theme="dark"] .hp-price span{color:#e8eaf0}
        .hp-price small{font-size:.82rem;color:#647086}
        [data-theme="dark"] .hp-price small{color:#8892a8}
        .hp-price-card ul{list-style:none;padding:0;margin:0 0 20px;display:grid;gap:8px;flex:1}
        .hp-price-card li{padding-left:22px;position:relative;font-size:.84rem;color:#475569;line-height:1.45}
        [data-theme="dark"] .hp-price-card li{color:#8892a8}
        .hp-price-card li::before{content:'';position:absolute;left:0;top:3px;width:14px;height:14px;background:#0B57D0;border-radius:50%;opacity:.14}
        .hp-price-card li::after{content:'';position:absolute;left:4px;top:6px;width:6px;height:3px;border-left:2px solid #0B57D0;border-bottom:2px solid #0B57D0;transform:rotate(-45deg)}
        .hp-price-cta{display:block;text-align:center;padding:10px;background:#e8f0fe;color:#0B57D0;border-radius:10px;font-weight:700;font-size:.9rem;text-decoration:none;transition:background .15s}
        .hp-price-cta:hover{background:#d2e3fc}
        [data-theme="dark"] .hp-price-cta{background:rgba(77,148,255,.1);color:#4d94ff}
        [data-theme="dark"] .hp-price-cta:hover{background:rgba(77,148,255,.18)}
        .hp-pricing-note{font-size:.84rem;color:#647086;text-align:center;max-width:680px;margin:28px auto 0;line-height:1.55}
        [data-theme="dark"] .hp-pricing-note{color:#8892a8}
        .hp-pricing-note strong{color:#0B57D0}

        /* ─── Final CTA ───────────────────────────────── */
        .hp-final-cta{text-align:center;padding:72px 24px;background:#0B57D0;color:#fff}
        .hp-final-cta h2{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;letter-spacing:-.03em;margin:0 0 12px}
        .hp-final-cta p{font-size:1.05rem;opacity:.88;margin:0 0 28px}
        .hp-final-cta .hp-cta{background:#fff;color:#0B57D0}
        .hp-final-cta .hp-cta:hover{box-shadow:0 8px 24px rgba(0,0,0,.2)}

        /* ─── Footer ──────────────────────────────────── */
        .hp-footer{padding:28px 24px;text-align:center;border-top:1px solid #e2e8f0}
        [data-theme="dark"] .hp-footer{border-top-color:#2d3044}
        .hp-footer p{font-size:.85rem;color:#647086;margin:0}
        [data-theme="dark"] .hp-footer p{color:#8892a8}
        .hp-footer-small{font-size:.76rem;color:#94a3b8;margin-top:4px !important}

        /* ─── Mobile ──────────────────────────────────── */
        @media(max-width:640px){
          .hp-hero{padding:48px 20px 40px}
          .hp-section{padding:48px 20px}
          .hp-demo-section,.hp-steps-section,.hp-pricing-section{padding-left:20px;padding-right:20px}
          .hp-create-grid{grid-template-columns:1fr}
          .hp-pricing-grid{grid-template-columns:1fr}
          .hp-steps{grid-template-columns:1fr;gap:24px}
          .hp-flip{width:min(340px,92vw)}
          .hp-cta-row{flex-direction:column;align-items:stretch}
          .hp-cta,.hp-cta-ghost{text-align:center}
        }
        @media(prefers-reduced-motion:reduce){
          .hp-flip-inner{transition:none}
          .hp-create-item:hover{transform:none}
        }
      `}</style>
    </div>
  );
}
