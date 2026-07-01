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
              <rect width="32" height="32" rx="8" fill="#E62020" />
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>Quickbrand</span>
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
          <p className="hp-eyebrow">Logo · Biglietti · Pronti per la stampa</p>
          <h1 className="hp-h1">
            Smetti di pagare le agenzie.<br />
            Il tuo brand, pronto per la<br />
            <span className="hp-h1-accent">tipografia in 60 secondi.</span>
          </h1>
          <p className="hp-sub">
            Quickbrand ti dà logo in SVG e biglietti da visita professionali
            in pochi clic. Editor a griglia con precisione svizzera, AI che
            ottimizza palette e testi in tempo reale, export PDF 10-up e
            vettoriali puri. Dall'idea al file pronto in 60 secondi.
          </p>
          <div className="hp-cta-row">
            {user ? (
              <Link to="/app" className="hp-cta">Vai all'App →</Link>
            ) : (
              <Link to="/login?register=1" className="hp-cta">Crea il tuo brand →</Link>
            )}
            <a href="#pricing" className="hp-cta-ghost">Vedi i pacchetti</a>
          </div>
          <p className="hp-hero-foot">Nessuna carta di credito · File pronti per la tipografia · 60 secondi</p>
        </div>
      </section>

      {/* ─── Cosa include Quickbrand ─────────────────────── */}
      <section className="hp-section">
        <h2 className="hp-section-h">Cosa include Quickbrand</h2>
        <div className="hp-create-grid">
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="4" x2="8" y2="10"/></svg>
            </div>
            <h3>Biglietti da visita</h3>
            <p>Layout split, centrato o sinistro. Foto, logo, QR sul retro con contatti e social. Export PDF 10-up pronto tipografia (A4 con 10 bigliettini già posizionati), PNG alta risoluzione o SVG vettoriale puro.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M12 2a14.5 14.5 0 0 1 0 20"/></svg>
            </div>
            <h3>Logo SVG</h3>
            <p>Builder con 4 template per settore (tech, food, fashion, professionista), 3 layout, 48 icone Lucide. Esporta SVG editabile o PNG fino a 2048px. Zero costi AI: qualità deterministica.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </div>
            <h3>QR Code</h3>
            <p>7 tipi: URL, testo, email, telefono, vCard, WiFi, SMS. Stili square, rounded o dots. Logo overlay opzionale. Export SVG vettoriale.</p>
          </article>
          <article className="hp-create-item">
            <div className="hp-create-icon" data-color="red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            </div>
            <h3>Preventivi</h3>
            <p>Fino a 4 opzioni per preventivo, con costi una tantum e mensili, IVA, acconto, saldo e clausole. PDF professionale. Per chi serve anche la parte commerciale.</p>
          </article>
        </div>
      </section>

      {/* ─── Card demo flip 3D ────────────────────────────── */}
      <section className="hp-section hp-demo-section">
        <h2 className="hp-section-h">Gratis con watermark. Sbloccata, pronta per la stampa.</h2>
        <p className="hp-section-sub">
          Tocca o passa il mouse sulla card per vedere il file finale.
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
                    <text x="0" y="40" textAnchor="start" fontFamily="Helvetica, Arial, sans-serif" fontSize="20" fontWeight="700" fill="#1A1A1A" fillOpacity="0.10" letterSpacing="1.5">QUICKBRAND · FREE</text>
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
            <h3>Scegli il settore</h3>
            <p>Logo builder con template tech, food, fashion o professionista. Personalizza testo, colori e icone Lucide. Anteprima live.</p>
          </li>
          <li className="hp-step">
            <span className="hp-step-num">2</span>
            <h3>Lascia lavorare l'AI</h3>
            <p>L'AI Co-Editor (DeepSeek) ottimizza palette e testi in tempo reale. Il grid editor con collision detection impedisce errori di layout: non puoi sbagliare.</p>
          </li>
          <li className="hp-step">
            <span className="hp-step-num">3</span>
            <h3>Esporta per la tipografia</h3>
            <p>SVG vettoriali puri per il logo, PDF 10-up A4 con 10 bigliettini già impaginati per la stampa. Senza watermark, 300 DPI.</p>
          </li>
        </ol>
      </section>

      {/* ─── Pricing — Subscription mensile ──────────────── */}
      <section className="hp-section hp-pricing-section" id="pricing">
        <h2 className="hp-section-h">Un piano. Tutto incluso.</h2>
        <p className="hp-section-sub">
          Il piano Pro copre l'AI che usi davvero e sblocca i file pronti per
          la tipografia su tutti i tuoi documenti.
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
            <div className="hp-price-badge">Per chi va in tipografia</div>
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
          Manutenzione mensile <strong>€49/mese</strong>: aggiornamenti, 1-2 grafiche, hosting
          gestito. A confronto: un'agenzia chiede €2.500-8.000 e 2-4 settimane
          di attesa. Quickbrand te li consegna in 60 secondi.
        </p>
      </section>

      {/* ─── CTA finale ───────────────────────────────────── */}
      <section className="hp-final-cta">
        <h2>Dall'idea alla tipografia in 60 secondi.</h2>
        <p>Crea logo e biglietti da visita adesso.</p>
        {user ? (
          <Link to="/app" className="hp-cta">Vai all'App →</Link>
        ) : (
          <Link to="/login?register=1" className="hp-cta">Crea il tuo brand →</Link>
        )}
      </section>

      <footer className="hp-footer">
        <p>© 2026 Quickbrand · Giovanni Cidu</p>
        <p className="hp-footer-small">Pagamenti gestiti personalmente via email · Cagliari, Italia</p>
      </footer>

      <style>{`
        /* ─── Palette tokens: The Classic (Red & Ink) ─── */
        .hp{
          font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          color:var(--qb-ink);
          background:var(--qb-paper);
          min-height:100vh;
          -webkit-font-smoothing:antialiased;
          --qb-red:#E62020;
          --qb-ink:#1A1A1A;
          --qb-paper:#FFFFFF;
          --qb-muted:#5C5C5C;
          --qb-surface:#F7F7F7;
          --qb-border:rgba(26,26,26,.18);
          --qb-red-soft:#FCE8E8;
          --qb-success:#10B981;
        }
        [data-theme="dark"] .hp{
          --qb-red:#FF3B3B;
          --qb-ink:#E8EAF0;
          --qb-paper:#0F1117;
          --qb-muted:#9AA0AE;
          --qb-surface:#14161F;
          --qb-border:#2D3044;
          --qb-red-soft:rgba(255,59,59,.12);
        }

        /* ─── Header ──────────────────────────────────── */
        .hp-header{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--qb-border)}
        [data-theme="dark"] .hp-header{background:rgba(15,17,23,.88);border-bottom-color:var(--qb-border)}
        .hp-header-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 24px}
        .hp-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem}
        .hp-nav{display:flex;gap:10px}
        .hp-btn-ghost{padding:8px 16px;border-radius:10px;font-weight:600;font-size:.88rem;color:var(--qb-ink);text-decoration:none;transition:background .15s}
        .hp-btn-ghost:hover{background:var(--qb-surface)}
        [data-theme="dark"] .hp-btn-ghost:hover{background:rgba(255,255,255,.04)}
        .hp-btn-primary{padding:8px 16px;border-radius:10px;font-weight:700;font-size:.88rem;color:#fff;background:var(--qb-ink);text-decoration:none;transition:box-shadow .15s,transform .1s}
        .hp-btn-primary:hover{box-shadow:0 4px 12px rgba(0,0,0,.18);transform:translateY(-1px)}

        /* ─── Hero ────────────────────────────────────── */
        .hp-hero{padding:80px 24px 64px;text-align:center}
        .hp-hero-inner{max-width:680px;margin:0 auto}
        .hp-eyebrow{font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--qb-red);margin:0 0 20px}
        .hp-h1{font-size:clamp(2rem,5.5vw,3.2rem);font-weight:900;letter-spacing:-.035em;line-height:1.08;margin:0 0 24px;color:var(--qb-ink)}
        .hp-h1-accent{color:var(--qb-red)}
        .hp-sub{font-size:1.1rem;color:var(--qb-ink);opacity:.78;line-height:1.6;margin:0 0 32px}
        .hp-cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
        .hp-cta{display:inline-block;padding:14px 32px;background:var(--qb-red);color:#fff;border-radius:12px;font-weight:800;font-size:1.02rem;text-decoration:none;letter-spacing:-.01em;transition:transform .15s,box-shadow .2s}
        .hp-cta:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(230,32,32,.32)}
        .hp-cta-ghost{display:inline-block;padding:14px 28px;color:var(--qb-ink);border:1px solid var(--qb-ink);border-radius:12px;font-weight:700;font-size:1.02rem;text-decoration:none;transition:background .15s,color .15s}
        .hp-cta-ghost:hover{background:var(--qb-ink);color:var(--qb-paper)}
        [data-theme="dark"] .hp-cta-ghost{color:var(--qb-ink);border-color:var(--qb-ink)}
        .hp-hero-foot{font-size:.82rem;color:var(--qb-muted);margin:0}

        /* ─── Section base ────────────────────────────── */
        .hp-section{max-width:1080px;margin:0 auto;padding:64px 24px}
        .hp-section-h{font-size:clamp(1.6rem,3.5vw,2.1rem);font-weight:900;letter-spacing:-.03em;margin:0 0 16px;text-align:center;color:var(--qb-ink)}
        .hp-section-h-secondary{margin-top:48px;font-size:clamp(1.3rem,3vw,1.7rem);position:relative}
        .hp-section-h-secondary::before{content:'';display:block;width:40px;height:2px;background:var(--qb-red);margin:0 auto 16px;opacity:.7}
        .hp-section-sub{font-size:1rem;color:var(--qb-muted);text-align:center;max-width:560px;margin:0 auto 40px;line-height:1.55}

        /* ─── Cosa include Quickbrand ─────────────────── */
        .hp-create-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
        .hp-create-item{background:var(--qb-paper);border:1px solid var(--qb-border);border-radius:14px;padding:24px;transition:transform .2s,box-shadow .2s,border-color .2s}
        .hp-create-item:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.06);border-color:var(--qb-ink)}
        [data-theme="dark"] .hp-create-item:hover{box-shadow:0 8px 24px rgba(0,0,0,.4)}
        .hp-create-icon{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;margin-bottom:14px}
        .hp-create-icon svg{width:22px;height:22px}
        .hp-create-icon[data-color="red"]{background:var(--qb-red-soft);color:var(--qb-red)}
        .hp-create-item h3{font-size:1rem;font-weight:800;margin:0 0 6px;color:var(--qb-ink)}
        .hp-create-item p{font-size:.85rem;color:var(--qb-muted);line-height:1.5;margin:0}

        /* ─── Card flip demo ──────────────────────────── */
        .hp-demo-section{background:linear-gradient(180deg,var(--qb-surface) 0%,var(--qb-paper) 100%);max-width:none;padding-left:24px;padding-right:24px}
        .hp-demo-section .hp-section-h,.hp-demo-section .hp-section-sub{position:relative;z-index:1}
        .hp-flip{perspective:1400px;width:min(440px,92vw);margin:0 auto;cursor:pointer;outline:none;aspect-ratio:85/55;position:relative}
        .hp-flip:focus-visible{outline:3px solid var(--qb-red);outline-offset:8px;border-radius:14px}
        .hp-flip-inner{position:relative;width:100%;height:100%;transition:transform .8s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}
        .hp-flip.is-flipped .hp-flip-inner{transform:rotateY(180deg)}
        .hp-flip-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:10px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.14)}
        .hp-flip-front{transform:rotateY(0)}
        .hp-flip-back{transform:rotateY(180deg)}
        .hp-card-scale{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
        .hp-card-scale .card-preview-wrap{position:absolute;inset:0;overflow:hidden;display:block;border-radius:0}
        .hp-card-scale .card-preview-side{width:100% !important;height:100% !important;max-width:100% !important;max-height:100% !important;aspect-ratio:85/55 !important;border:none !important;border-radius:0 !important;box-shadow:none !important;display:block}
        .hp-card-scale .card-front-split{font-size:0.28em;gap:0}
        .hp-card-scale .card-photo.split{width:100%;height:100%}
        .hp-card-scale .card-front-text{gap:1px}
        .hp-card-scale .card-name{font-size:1em !important;letter-spacing:0.05em !important;white-space:normal !important;line-height:1.05 !important;overflow:visible !important;text-overflow:clip !important}
        .hp-card-scale .card-title{font-size:0.65em !important}
        .hp-card-scale .card-company{font-size:0.6em !important}
        .hp-card-scale .card-split-footer{height:14%}
        .hp-card-scale .card-logo.split{height:100% !important;width:auto !important;max-width:80%}
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
        [data-theme="dark"] .hp-watermark-overlay{opacity:.55}
        .hp-tier-tag{position:absolute;bottom:8px;left:8px;padding:4px 10px;border-radius:6px;font-size:.6rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;backdrop-filter:blur(8px);z-index:10;pointer-events:none}
        .hp-tier-tag[data-tier="free"]{background:rgba(26,26,26,.92);color:#fff}
        .hp-tier-tag[data-tier="unlocked"]{background:rgba(16,185,129,.92);color:#fff}
        .hp-demo-hint{text-align:center;font-size:.85rem;color:var(--qb-muted);margin:24px 0 0;min-height:1.2em}

        /* ─── Steps ───────────────────────────────────── */
        .hp-steps-section{background:var(--qb-paper);max-width:none;padding-left:24px;padding-right:24px}
        .hp-steps{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;max-width:1000px;margin-left:auto;margin-right:auto}
        .hp-step{position:relative;padding-left:0}
        .hp-step-num{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--qb-ink);color:var(--qb-paper);font-weight:900;font-size:1.1rem;margin-bottom:14px}
        .hp-step h3{font-size:1.05rem;font-weight:800;margin:0 0 6px;color:var(--qb-ink)}
        .hp-step p{font-size:.9rem;color:var(--qb-muted);line-height:1.55;margin:0}

        /* ─── Pricing ─────────────────────────────────── */
        .hp-pricing-section{padding-top:64px;padding-bottom:64px}
        .hp-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;max-width:1080px;margin:0 auto}
        .hp-price-card{position:relative;background:var(--qb-paper);border:1px solid var(--qb-border);border-radius:16px;padding:28px 22px;display:flex;flex-direction:column;transition:border-color .2s}
        .hp-price-card:hover{border-color:var(--qb-ink)}
        .hp-price-featured{border-color:transparent;box-shadow:0 0 0 2px var(--qb-red),0 10px 28px rgba(230,32,32,.14)}
        .hp-price-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--qb-red);color:#fff;font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:5px 14px;border-radius:100px}
        .hp-price-card h3{font-size:1.15rem;font-weight:800;margin:0 0 8px;color:var(--qb-ink)}
        .hp-price{display:flex;align-items:baseline;gap:6px;margin-bottom:18px}
        .hp-price span{font-size:2.2rem;font-weight:900;color:var(--qb-ink);letter-spacing:-.02em}
        .hp-price small{font-size:.82rem;color:var(--qb-muted)}
        .hp-price-card ul{list-style:none;padding:0;margin:0 0 20px;display:grid;gap:8px;flex:1}
        .hp-price-card li{padding-left:22px;position:relative;font-size:.84rem;color:var(--qb-muted);line-height:1.45}
        .hp-price-card li::before{content:'';position:absolute;left:0;top:3px;width:14px;height:14px;background:var(--qb-red);border-radius:50%;opacity:.14}
        .hp-price-card li::after{content:'';position:absolute;left:4px;top:6px;width:6px;height:3px;border-left:2px solid var(--qb-red);border-bottom:2px solid var(--qb-red);transform:rotate(-45deg)}
        .hp-price-cta{display:block;text-align:center;padding:10px;background:var(--qb-paper);color:var(--qb-ink);border:1px solid var(--qb-ink);border-radius:10px;font-weight:700;font-size:.9rem;text-decoration:none;transition:background .15s,color .15s}
        .hp-price-cta:hover{background:var(--qb-ink);color:var(--qb-paper)}
        .hp-pricing-note{font-size:.84rem;color:var(--qb-muted);text-align:center;max-width:680px;margin:28px auto 0;line-height:1.55}
        .hp-pricing-note strong{color:var(--qb-ink)}

        /* ─── Final CTA ───────────────────────────────── */
        .hp-final-cta{text-align:center;padding:72px 24px;background:var(--qb-ink);color:var(--qb-paper)}
        .hp-final-cta h2{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;letter-spacing:-.03em;margin:0 0 12px;color:#fff}
        .hp-final-cta p{font-size:1.05rem;opacity:.72;margin:0 0 28px;color:#fff}
        .hp-final-cta .hp-cta{background:var(--qb-red);color:#fff}
        .hp-final-cta .hp-cta:hover{box-shadow:0 8px 24px rgba(230,32,32,.4)}

        /* ─── Footer ──────────────────────────────────── */
        .hp-footer{padding:28px 24px;text-align:center;border-top:1px solid var(--qb-border);background:var(--qb-paper)}
        .hp-footer p{font-size:.85rem;color:var(--qb-muted);margin:0}
        .hp-footer-small{font-size:.76rem;color:var(--qb-muted);opacity:.7;margin-top:4px !important}

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
