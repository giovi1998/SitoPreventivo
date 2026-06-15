import { TWEAK_DEFAULTS } from '../constants.js';

export default function GlobalStyles() {
  return <style>{`
    :root {
      --accent: var(--ocd-tweak-accent-color, ${TWEAK_DEFAULTS.accentColor});
      --sidebar: var(--ocd-tweak-sidebar-ink, ${TWEAK_DEFAULTS.sidebarInk});
      --canvas: var(--ocd-tweak-canvas-warmth, ${TWEAK_DEFAULTS.canvasWarmth});
      --scale: var(--ocd-tweak-document-scale, ${TWEAK_DEFAULTS.documentScale});
      --density: var(--ocd-tweak-density, ${TWEAK_DEFAULTS.density});
      --ink: #07111f;
      --muted: #647086;
      --line: #c8d0df;
      --surface: #ffffff;
      --soft: #edf2fa;
      --green: #11845b;
      --amber: #a66200;
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--canvas); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, textarea, select { font: inherit; }
    button { cursor: pointer; }
    .app { min-height: 100vh; display: grid; grid-template-columns: 280px minmax(0, 1fr); background: var(--canvas); }
    .sidebar { background: var(--sidebar); color: #ecf5ff; padding: 28px 20px; display: flex; flex-direction: column; gap: 28px; position: sticky; top: 0; height: 100vh; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .mark { width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.24); border-radius: 14px; display: grid; place-items: center; color: white; background: linear-gradient(145deg, rgba(255,255,255,.18), rgba(255,255,255,.02)); font-weight: 900; letter-spacing: -.08em; }
    .brand h1 { font-size: 1.2rem; margin: 0; letter-spacing: -.03em; }
    .brand p { margin: 2px 0 0; color: #adc0d5; font-size: .75rem; letter-spacing: .13em; text-transform: uppercase; }
    .nav { display: grid; gap: 8px; }
    .nav a, .side-utility button { border: 0; color: inherit; background: transparent; padding: 12px 14px; border-radius: 14px; display: flex; align-items: center; gap: 12px; text-align: left; font-weight: 720; text-decoration: none; }
    .nav a svg, .side-utility svg, .icon-btn svg, .action svg, .panel-title svg, .primary svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .nav a.active { background: color-mix(in srgb, var(--accent) 28%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    .side-utility { margin-top: auto; border-top: 1px solid rgba(255,255,255,.16); padding-top: 18px; display: grid; gap: 8px; color: #dce9f7; }
    .main { min-width: 0; }
    .topbar { height: 72px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.72); backdrop-filter: blur(18px); display: flex; align-items: center; justify-content: space-between; padding: 0 32px; position: sticky; top: 0; z-index: 5; }
    .crumb { display: flex; align-items: center; gap: 12px; font-weight: 850; color: var(--accent); font-size: 1.35rem; letter-spacing: -.04em; }
    .badge { border: 1px solid color-mix(in srgb, var(--accent) 35%, #b9c4d5); background: color-mix(in srgb, var(--accent) 10%, white); color: var(--accent); border-radius: 9px; padding: 5px 9px; font-weight: 800; font-size: .76rem; }
    .toolbar { display: flex; gap: 12px; align-items: center; }
    .search { min-width: 320px; border: 1px solid var(--line); border-radius: 13px; background: white; padding: 11px 14px; color: var(--muted); }
    .icon-btn, .ghost, .primary, .action { border: 1px solid var(--line); background: white; border-radius: 13px; min-height: 44px; padding: 0 15px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; color: var(--ink); font-weight: 750; text-decoration: none; }
    .primary { background: var(--accent); color: white; border-color: color-mix(in srgb, var(--accent) 82%, #052258); box-shadow: 0 12px 30px color-mix(in srgb, var(--accent) 25%, transparent); }
    .content { padding: calc(34px * var(--density)) calc(40px * var(--density)) 60px; }
    .create-grid { display: grid; grid-template-columns: minmax(300px, 420px) minmax(560px, 1fr); gap: 28px; align-items: start; }
    .assistant-panel, .collection-card, .inspector { background: rgba(255,255,255,.78); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 20px 55px rgba(19,35,58,.06); }
    .assistant-panel { overflow: hidden; }
    .panel-section { padding: calc(22px * var(--density)); border-bottom: 1px solid var(--line); }
    .panel-section:last-child { border-bottom: 0; }
    .panel-title { display: flex; align-items: center; gap: 10px; margin: 0 0 16px; color: var(--accent); font-size: 1rem; font-weight: 900; letter-spacing: -.01em; }
    .chat { display: grid; gap: 14px; }
    .bubble { padding: 14px 16px; border-radius: 18px; line-height: 1.45; font-size: .96rem; }
    .bubble.ai { background: #eef4ff; border: 1px solid #cbd7ec; color: #152236; border-top-left-radius: 6px; }
    .bubble.user { background: var(--accent); color: white; margin-left: 44px; border-bottom-right-radius: 6px; }
    .prompt { display: flex; gap: 8px; border: 1px solid var(--line); background: white; border-radius: 999px; padding: 8px; }
    .prompt input { flex: 1; border: 0; outline: 0; padding: 0 8px; min-width: 0; }
    .send { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--accent); color: white; font-weight: 900; }
    .field { display: grid; gap: 7px; margin-bottom: 14px; }
    label { color: #344054; font-size: .78rem; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
    input, textarea, select { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; background: white; color: var(--ink); outline: none; }
    textarea { min-height: 76px; resize: vertical; }
    input:focus, textarea:focus, select:focus, button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 22%, transparent); outline-offset: 2px; border-color: var(--accent); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border: 1px solid var(--line); background: #f8fbff; border-radius: 999px; padding: 8px 11px; color: #24344a; font-weight: 700; font-size: .84rem; }
    .canvas-wrap { display: grid; gap: 18px; }
    .editor-bar { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .editor-bar h2, .collection-head h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.8rem); letter-spacing: -.065em; line-height: .95; }
    .editor-bar p, .collection-head p { margin: 8px 0 0; color: var(--muted); font-size: 1.05rem; }
    .doc-stage { overflow: auto; padding: 24px; background: linear-gradient(180deg, #e9eef7, #f8faff); border: 1px solid var(--line); border-radius: 24px; min-height: 760px; }
    .document { width: min(100%, 794px); min-height: 1030px; margin: 0 auto; transform: scale(var(--scale)); transform-origin: top center; background: white; color: #101828; box-shadow: 0 24px 80px rgba(35,44,62,.16); border: 1px solid #d7deea; padding: 56px 60px; }
    .doc-topline { height: 8px; background: var(--accent); margin: -56px -60px 54px; }
    .doc-head { display: grid; grid-template-columns: 1fr auto; gap: 24px; padding-bottom: 44px; border-bottom: 1px solid #cfd6e4; }
    .doc-head h3 { color: var(--accent); font-size: 2.45rem; margin: 0 0 8px; letter-spacing: -.05em; }
    .company { text-align: right; line-height: 1.55; }
    .meta { display: grid; grid-template-columns: 1.2fr .8fr .8fr; gap: 22px; padding: 28px 0; border-bottom: 1px solid #d8deea; }
    .kicker { font-size: .72rem; letter-spacing: .14em; color: #46546a; text-transform: uppercase; font-weight: 850; }
    .meta strong { display: block; margin-top: 8px; font-size: 1.15rem; }
    .intro { margin: 32px 0; color: #39465b; line-height: 1.65; }
    .line-items { width: 100%; border-collapse: collapse; margin-top: 22px; }
    .line-items th { text-align: left; font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: #344054; border-bottom: 2px solid #d8deea; padding: 14px 0; }
    .line-items td { vertical-align: top; padding: 20px 0; border-bottom: 1px solid #e4e8f0; }
    .line-items .num, .line-items th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .desc strong { display: block; margin-bottom: 5px; }
    .desc span { color: #4f5f76; line-height: 1.45; }
    .totals { margin: 46px 0 34px auto; width: 48%; display: grid; gap: 13px; }
    .total-row { display: flex; justify-content: space-between; border-bottom: 1px solid #dde2eb; padding-bottom: 10px; }
    .total-row.grand { border-bottom: 3px solid #111827; font-size: 1.35rem; font-weight: 950; color: var(--accent); }
    .doc-sections { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 34px; }
    .doc-section { border: 1px solid #e0e5ee; background: #f8fafd; border-radius: 14px; padding: 14px; font-size: .86rem; color: #35445b; }
    .doc-foot { margin-top: 46px; padding-top: 18px; border-top: 1px solid #d7deea; display: flex; justify-content: space-between; color: #687589; font-size: .82rem; }
    .document.style-classic { font-family: Georgia, "Times New Roman", serif; border-radius: 0; border: 4px double var(--line); }
    .document.style-classic .doc-topline { display: none; }
    .document.style-minimal { box-shadow: none; border: 1px solid var(--line); background: white; }
    .document.style-minimal .doc-topline { display: none; }
    .document.style-minimal .doc-section { background: transparent; border: none; border-left: 3px solid var(--accent); border-radius: 0; padding-left: 10px; }
    .document.style-editorial { font-family: Georgia, serif; background: #fdfcf7; color: #2c251e; }
    .document.style-editorial .doc-topline { height: 4px; }
    .document.style-compact { padding: 30px 40px; min-height: 750px; font-size: 0.9rem; }
    .document.style-compact .doc-topline { margin: -30px -40px 30px; }
    .document.style-compact td { padding: 10px 0; }
    .document.style-compact .intro { margin: 15px 0; }
    .document.style-compact .totals { margin: 20px 0 20px auto; }
    .document.style-tech { font-family: "Courier New", Courier, monospace; border-radius: 0; }
    .document.style-tech .doc-topline { background: #000; }
    .document.style-tech .doc-section { border-radius: 0; background: #fafafa; border: 1px dashed var(--line); }
    .document.style-bold { border: 4px solid var(--accent); }
    .document.style-bold .doc-head h3 { font-weight: 900; text-transform: uppercase; }
    .document.style-soft { border-radius: 32px; box-shadow: 0 30px 70px rgba(0,0,0,0.08); }
    .document.style-soft .doc-section { border-radius: 20px; }
    .document.style-warm { background: #faf7f2; }
    .document.style-vintage { background: #f7f1e3; font-family: "Times New Roman", Times, serif; color: #403020; border: 1px solid #d1ccc0; }
    .document.style-vintage .doc-topline { background: #845c3e; }
    .inspector { padding: 18px; display: grid; gap: 16px; }
    .item-editor { border: 1px solid #dbe2ee; border-radius: 16px; padding: 14px; background: #fbfdff; display: grid; gap: 10px; }
    .row { display: grid; grid-template-columns: 1fr 96px 120px; gap: 9px; }
    .template-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
    .template { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: white; font-weight: 800; text-align: left; }
    .template.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, white); }
    .template::before { content: ""; display: block; height: 30px; border-radius: 9px; margin-bottom: 8px; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 30%, white)); }
    .collection-head { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
    .filters { display: flex; gap: 12px; align-items: center; }
    .quote-list { display: grid; gap: 16px; }
    .collection-card { display: grid; grid-template-columns: 130px 1.2fr 1fr 120px 1.2fr; gap: 20px; align-items: center; padding: 22px 24px; }
    .status { display: inline-flex; justify-content: center; border-radius: 999px; padding: 7px 11px; font-weight: 900; font-size: .78rem; }
    .status.boza, .status.bozza { background: #f0f1f5; color: #666c7c; }
    .status.inviato { background: #e6eefc; color: var(--accent); }
    .status.accettato { background: #f7eddc; color: var(--amber); }
    .quote-title strong { display: block; font-size: 1.08rem; margin-bottom: 4px; }
    .quote-title span, .muted { color: var(--muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .action { min-height: 38px; padding: 0 10px; border-color: transparent; background: transparent; font-weight: 700; text-decoration: none; }
    .mobile-tabs { display: none; }
    @media (max-width: 1180px) {
      .create-grid { grid-template-columns: 1fr; }
      .inspector { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .collection-card { grid-template-columns: 1fr 1fr; }
      .actions { justify-content: flex-start; grid-column: 1 / -1; }
    }
    @media (max-width: 820px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { position: fixed; inset: auto 12px 12px; height: auto; z-index: 10; border-radius: 24px; padding: 10px; flex-direction: row; justify-content: center; }
      .brand, .side-utility { display: none; }
      .nav { grid-template-columns: repeat(2, 1fr); width: 100%; }
      .nav a { justify-content: center; font-size: 0; padding: 12px; }
      .nav a svg { width: 23px; height: 23px; }
      .topbar { padding: 0 16px; height: auto; min-height: 68px; flex-wrap: wrap; gap: 10px; }
      .search { display: none; }
      .content { padding: 24px 16px 110px; }
      .editor-bar, .collection-head { align-items: flex-start; flex-direction: column; }
      .toolbar .ghost { display: none; }
      .doc-stage { padding: 10px; min-height: auto; }
      .document { width: 720px; transform: scale(.56); transform-origin: top left; margin-bottom: -460px; }
      .inspector { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; }
      .collection-card { grid-template-columns: 1fr; gap: 10px; }
      .filters { width: 100%; flex-wrap: wrap; }
    }
    @media print {
      body { background: white; }
      .topbar, .sidebar, .assistant-panel, .inspector, .editor-bar, .toast { display: none !important; }
      .app { display: block; }
      .content { padding: 0; }
      .create-grid { display: block; }
      .canvas-wrap { display: block; }
      .doc-stage { position: relative; margin: 0; padding: 0; border: none; background: none; min-height: auto; overflow: visible; }
      .document { transform: none !important; box-shadow: none; border: none; padding: 0; width: 100%; min-height: auto; margin: 0; }
    }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #07111f;
      color: white;
      padding: 14px 20px;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease;
      font-weight: 700;
      font-size: 0.95rem;
    }
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `}</style>;
      .app-shell { min-height: 100vh; display: grid; grid-template-columns: 280px minmax(0, 1fr); background: var(--canvas); }
      .workspace { min-width: 0; }
      .brand span { width: 42px; height: 42px; border: 1px solid rgba(255,255,255,.24); border-radius: 14px; display: grid; place-items: center; color: white; background: linear-gradient(145deg, rgba(255,255,255,.18), rgba(255,255,255,.02)); font-weight: 950; letter-spacing: -.08em; }
      .brand strong { display: block; font-size: 1.05rem; letter-spacing: -.03em; }
      .brand small { display: block; color: #adc0d5; font-size: .72rem; letter-spacing: .13em; text-transform: uppercase; }
      .nav button, .side-utility button { border: 0; color: inherit; background: transparent; padding: 12px 14px; border-radius: 14px; display: flex; align-items: center; gap: 12px; text-align: left; font-weight: 800; }
      .nav button svg, .side-utility svg, .card-actions svg, .primary svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .nav button.active { background: color-mix(in srgb, var(--accent) 28%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
      .side-card { border: 1px solid rgba(255,255,255,.16); border-radius: 18px; padding: 16px; background: rgba(255,255,255,.06); color: #d9e7f8; }
      .side-card p { margin: 8px 0 0; color: #adc0d5; line-height: 1.45; }
      .topbar p { margin: 0 0 4px; color: var(--accent); font-size: .78rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
      .topbar h1 { margin: 0; font-size: clamp(1.55rem, 2.6vw, 2.45rem); letter-spacing: -.055em; }
      .top-actions { display: flex; gap: 10px; align-items: center; }
      .top-actions button, .block-head button, .section-library button, .card-actions button, .mini-grid button { border: 1px solid var(--line); background: white; border-radius: 13px; min-height: 42px; padding: 0 13px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: var(--ink); font-weight: 800; }
      .editor-grid { padding: calc(30px * var(--density)); display: grid; grid-template-columns: minmax(280px, 360px) minmax(360px, 520px) minmax(520px, 1fr); gap: 20px; align-items: start; }
      .panel, .collection-card { background: rgba(255,255,255,.82); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 20px 55px rgba(19,35,58,.06); }
      .panel { padding: 22px; display: grid; gap: 18px; }
      .panel-kicker { color: var(--accent); font-weight: 900; font-size: .76rem; text-transform: uppercase; letter-spacing: .13em; }
      .panel h2, .collection-head h2 { margin: 0; font-size: clamp(1.65rem, 3vw, 2.45rem); letter-spacing: -.055em; line-height: 1; }
      .panel p, .collection-head span { color: var(--muted); line-height: 1.5; margin: 0; }
      .ai-actions, .style-grid, .swatches, .section-library, .card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .ai-actions button, .style-grid button { border: 1px solid var(--line); border-radius: 999px; background: #f8fbff; padding: 9px 12px; font-weight: 800; color: #24344a; }
      .wide { width: 100%; min-height: 46px; }
      .activity-log { border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line)); background: color-mix(in srgb, var(--accent) 7%, white); border-radius: 16px; padding: 13px; display: grid; gap: 5px; }
      .activity-log span, .block-head span { color: var(--muted); font-size: .76rem; font-weight: 850; text-transform: uppercase; letter-spacing: .1em; }
      .stack, .editor-block, .items-editor, .section-list { display: grid; gap: 12px; }
      .editor-block { border-top: 1px solid var(--line); padding-top: 16px; }
      .editor-block h3 { margin: 0; font-size: .96rem; letter-spacing: -.01em; }
      .form-grid, .mini-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .block-head, .card-top, .card-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .swatches button { width: 30px; height: 30px; border-radius: 999px; border: 2px solid white; background: var(--swatch); box-shadow: 0 0 0 1px var(--line); }
      .swatches button.selected, .style-grid button.selected { outline: 3px solid color-mix(in srgb, var(--accent) 25%, transparent); border-color: var(--accent); }
      .item-editor, .section-edit { border: 1px solid #dbe2ee; border-radius: 16px; padding: 14px; background: #fbfdff; display: grid; gap: 10px; }
      .preview-wrap { overflow: auto; padding: 20px; background: linear-gradient(180deg, #e9eef7, #f8faff); border: 1px solid var(--line); border-radius: 24px; min-height: 760px; }
      .document { --accent: var(--doc-accent, var(--accent)); transform: scale(var(--scale)); }
      .doc-hero { display: grid; grid-template-columns: 1fr 210px; gap: 24px; padding-bottom: 34px; border-bottom: 1px solid #cfd6e4; }
      .doc-hero h2 { color: var(--accent); font-size: 2.4rem; margin: 0 0 10px; letter-spacing: -.05em; }
      .doc-meta, .doc-client span { color: #46546a; font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; font-weight: 850; }
      .doc-client { text-align: right; display: grid; gap: 6px; align-content: start; }
      .doc-client strong { font-size: 1.05rem; }
      .doc-items { display: grid; gap: 0; margin-top: 12px; }
      .doc-row { display: grid; grid-template-columns: 1fr auto; gap: 24px; padding: 17px 0; border-bottom: 1px solid #e4e8f0; }
      .doc-row p, .doc-box p, .doc-foot { color: #4f5f76; line-height: 1.5; }
      .doc-row span { font-variant-numeric: tabular-nums; font-weight: 850; }
      .doc-boxes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 30px; }
      .doc-box { border: 1px solid #e0e5ee; background: #f8fafd; border-radius: 14px; padding: 14px; }
      .totals div { display: flex; justify-content: space-between; border-bottom: 1px solid #dde2eb; padding-bottom: 10px; }
      .totals .grand { border-bottom: 3px solid #111827; font-size: 1.35rem; font-weight: 950; color: var(--accent); }
      .collection-view { padding: calc(34px * var(--density)) calc(40px * var(--density)) 70px; }
      .collection-head { margin-bottom: 26px; }
      .collection-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .collection-card { padding: 22px; display: grid; gap: 14px; }
      .collection-card.active { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent); }
      .collection-card h3 { margin: 0; font-size: 1.15rem; }
      .collection-card p { margin: 0; color: var(--muted); }
      @media (max-width: 1320px) { .editor-grid { grid-template-columns: minmax(300px, .82fr) minmax(520px, 1.18fr); } .ai-panel { grid-column: 1; } .manual-panel { grid-column: 1; } .preview-wrap { grid-column: 2; grid-row: 1 / span 2; } }
      @media (max-width: 980px) { .editor-grid { grid-template-columns: 1fr; } .ai-panel, .manual-panel, .preview-wrap { grid-column: auto; grid-row: auto; } .app-shell { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; } }
      @media (max-width: 760px) { .topbar, .top-actions { align-items: flex-start; flex-direction: column; height: auto; padding: 16px; } .search { min-width: 0; } .editor-grid, .collection-view { padding: 18px; } .form-grid, .mini-grid, .doc-hero, .doc-boxes { grid-template-columns: 1fr; } .document { width: 720px; transform: scale(.56); transform-origin: top left; margin-bottom: -430px; } }

}
