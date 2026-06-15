export default function GlobalStyles() {
  return <style>{`
    :root{--accent:var(--ocd-tweak-accent-color,#0B57D0);--sidebar:var(--ocd-tweak-sidebar-ink,#082033);--canvas:var(--ocd-tweak-canvas-warmth,#F6F8FC);--density:var(--ocd-tweak-density,1);--ink:#07111f;--muted:#647086;--line:#c8d0df;--surface:#fff;--green:#11845b;--amber:#a66200}
    *{box-sizing:border-box}html{background:var(--canvas)}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,var(--canvas),#eef3fb 54%,#ffffff);color:var(--ink)}
    button,input,textarea{font:inherit}
    button{border:1px solid var(--line);background:#fff;border-radius:12px;padding:.72rem .9rem;cursor:pointer;font-weight:850;color:var(--ink);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
    button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(8,32,51,.09)}
    button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 35%,transparent);outline-offset:2px}
    input,textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:.82rem;background:#fff;color:var(--ink);transition:border-color .2s,box-shadow .2s}
    input:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
    textarea{min-height:84px;resize:vertical;line-height:1.45}
    label{display:grid;gap:.45rem;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:var(--muted)}

    /* ─── APP SHELL ─────────────────────────────────── */
    .app-shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}

    /* ─── SIDEBAR ───────────────────────────────────── */
    .sidebar{background:radial-gradient(circle at 10% 0%,rgba(255,255,255,.12),transparent 40%),linear-gradient(180deg,#0a1929 0%,#082033 100%);color:#fff;padding:24px 20px;display:flex;flex-direction:column;gap:24px;border-right:1px solid rgba(255,255,255,.06)}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#3b82f6);color:#fff;flex-shrink:0}
    .brand strong{display:block;font-size:.95rem;font-weight:800;letter-spacing:-.02em}
    .brand small{display:block;color:#8896ab;margin-top:2px;font-size:.78rem}
    .sidebar nav{display:grid;gap:4px}
    .sidebar nav button{display:flex;align-items:center;gap:10px;background:transparent;color:#8896ab;border:none;border-radius:10px;padding:10px 14px;text-align:left;font-size:.88rem;font-weight:600;transition:all .15s}
    .sidebar nav button svg{flex-shrink:0;opacity:.6;transition:opacity .15s}
    .sidebar nav button:hover{background:rgba(255,255,255,.06);color:#cfe0f2;transform:none;box-shadow:none}
    .sidebar nav button:hover svg{opacity:.9}
    .sidebar nav button.active{background:rgba(255,255,255,.1);color:#fff;font-weight:700}
    .sidebar nav button.active svg{opacity:1;color:var(--accent)}
    .side-card{background:rgba(255,255,255,.05);border-radius:14px;padding:16px;margin-top:auto;border:1px solid rgba(255,255,255,.06)}
    .side-user{display:flex;align-items:center;gap:12px}
    .side-avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;flex-shrink:0;color:#8896ab}
    .side-card b{display:block;font-size:.85rem;font-weight:700;margin-bottom:2px}
    .side-card p{margin:0;font-size:.78rem;color:#8896ab;line-height:1.4}
    .side-utility{display:grid;gap:6px}
    .side-utility .logout-btn,.side-utility .login-link{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);color:#8896ab;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 14px;text-decoration:none;font-size:.85rem;font-weight:600;transition:all .15s}
    .side-utility .logout-btn:hover,.side-utility .login-link:hover{background:rgba(255,255,255,.1);color:#cfe0f2;transform:none;box-shadow:none}

    /* ─── WORKSPACE / TOPBAR ────────────────────────── */
    .workspace{display:flex;flex-direction:column;min-height:100vh}
    .topbar{height:68px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.8);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:5}
    .topbar p{margin:0;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800}
    .topbar h1{margin:0;font-size:1.25rem;font-weight:900;letter-spacing:-.03em}
    .top-actions{display:flex;gap:8px}
    .top-actions button{display:flex;align-items:center;gap:7px;font-size:.85rem;padding:9px 16px;border-radius:10px;font-weight:700}
    .top-actions button svg{flex-shrink:0}
    .top-btn-save{background:#fff;color:var(--ink);border:1px solid var(--line)}
    .top-btn-save:hover{border-color:var(--accent);color:var(--accent)}
    .top-btn-export{background:var(--accent);color:#fff;border:1px solid color-mix(in srgb,var(--accent) 80%,#000);box-shadow:0 2px 8px color-mix(in srgb,var(--accent) 20%,transparent)}
    .top-btn-export:hover{background:color-mix(in srgb,var(--accent) 90%,#000);box-shadow:0 4px 16px color-mix(in srgb,var(--accent) 30%,transparent)}

    /* ─── EDITOR GRID ───────────────────────────────── */
    .editor-grid{display:grid;grid-template-columns:340px 340px 1fr;gap:0;flex:1;overflow:hidden;min-height:0}
    .panel{overflow-y:auto;padding:24px;border-right:1px solid var(--line);min-height:0}
    .panel:last-child{border-right:none}
    .panel-kicker{font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);font-weight:900;margin-bottom:6px}
    .panel h2{margin:0 0 8px;font-size:1rem;font-weight:900;letter-spacing:-.02em}
    .panel p{margin:0 0 12px;font-size:.82rem;color:var(--muted);line-height:1.5}
    .ai-panel textarea{min-height:80px}
    .api-key-section{margin:0 0 12px;padding:10px;background:#f8fafc;border-radius:10px;border:1px solid var(--line)}
    .api-key-label{display:grid;gap:4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:var(--muted)}
    .api-key-input{font-size:.82rem!important;padding:.6rem!important;font-family:monospace}
    .api-key-status{font-size:.72rem;font-weight:700;margin-top:4px;display:block}
    .api-key-status.ok{color:var(--green)}
    .api-key-status.no{color:var(--amber)}
    .ai-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
    .ai-actions button{font-size:.75rem;padding:6px 10px}
    .primary.wide{width:100%;background:var(--accent);color:#fff;border-color:color-mix(in srgb,var(--accent) 82%,#052258);margin-top:6px}
    .activity-log{margin-top:12px;padding:10px;background:#f8fafc;border-radius:10px;border:1px solid var(--line)}
    .activity-log span{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800;margin-bottom:4px}
    .activity-log b{display:block;font-size:.78rem;color:var(--ink)}

    .ai-log-panel{margin-top:12px;padding:10px;background:#0f172a;border-radius:10px;border:1px solid #1e293b;max-height:200px;overflow-y:auto;font-family:'JetBrains Mono',monospace;font-size:.7rem}
    .ai-log-title{display:block;font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:700;margin-bottom:6px}
    .ai-log-entry{padding:3px 0;color:#94a3b8;line-height:1.4;border-bottom:1px solid #1e293b}
    .ai-log-entry:last-child{border-bottom:none}
    .ai-log-entry .ai-log-time{color:#475569;margin-right:6px}
    .ai-log-entry.info{color:#60a5fa}
    .ai-log-entry.success{color:#34d399}
    .ai-log-entry.error{color:#f87171}
    .ai-log-entry.empty{color:#475569;font-style:italic}

    /* ─── MANUAL CONTROLS ───────────────────────────── */
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .stack{display:grid;gap:14px}
    .section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .section-head h3{margin:0}
    .control-block{margin-bottom:20px;border-top:1px solid var(--line);padding-top:16px}
    .control-block h3{margin:0 0 10px;font-size:.88rem;font-weight:900}
    .swatches{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
    .swatches button{width:36px;height:36px;border-radius:50%;border:3px solid transparent;padding:0;transition:transform .15s,box-shadow .15s}
    .swatches button:hover{transform:scale(1.15)}
    .swatches button.selected{border-color:var(--ink);box-shadow:0 0 0 2px #fff,0 0 0 4px var(--ink);transform:scale(1.1)}

    .option-editor{border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff;margin-bottom:10px;display:grid;gap:8px;transition:border-color .15s}
    .option-editor:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .option-title-input{font-weight:800;font-size:.92rem}
    .option-editor .mini-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}
    .option-editor .mini-row label{display:grid;gap:4px;font-size:.7rem}
    .checkbox-label{display:flex!important;align-items:center;gap:6px;font-size:.78rem;text-transform:none;letter-spacing:0;font-weight:700;color:var(--ink);cursor:pointer;white-space:nowrap}
    .checkbox-label input[type="checkbox"]{width:auto;height:auto;border-radius:4px}
    .btn-remove{font-size:.75rem;padding:6px 10px;color:#dc2626;border-color:#fca5a5;background:transparent}
    .btn-remove:hover{background:#fef2f2;border-color:#dc2626;color:#dc2626;transform:none;box-shadow:none}

    .clause-editor{border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff;margin-bottom:10px;display:grid;gap:8px;transition:border-color .15s}
    .clause-editor:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .clause-editor button{font-size:.75rem;padding:6px 10px;color:#dc2626;border-color:#fca5a5}
    .clause-editor button:hover{background:#fef2f2;border-color:#dc2626;color:#dc2626;transform:none;box-shadow:none}

    /* ─── PREVIEW ───────────────────────────────────── */
    .preview-wrap{overflow:auto;padding:28px;background:#f1f5f9;min-height:0}

    /* Document styles — matching Francesca PDF */
    .document{width:min(100%,794px);max-width:100%;margin:0 auto;background:#fff;color:#101828;box-shadow:0 24px 80px rgba(35,44,62,.12);border:1px solid #d7deea;padding:48px;font-family:Georgia,'Times New Roman',serif;line-height:1.6;overflow:hidden;word-wrap:break-word}
    .doc-title-section{margin-bottom:32px}
    .doc-main-title{margin:0 0 20px;font-size:2rem;letter-spacing:-.03em;font-weight:700}
    .doc-client-info{border-top:1px solid #d7deea;padding-top:16px}
    .doc-client-info p{margin:4px 0;font-size:.95rem}
    .doc-intro-text{margin:24px 0;padding:16px 0;border-top:1px solid #d7deea;border-bottom:1px solid #d7deea}
    .doc-intro-text p{margin:0;color:#39465b;font-size:.92rem;line-height:1.6}

    .doc-option{margin:32px 0;padding:20px;border:1px solid #e0e5ee;background:#f8fafd;border-radius:14px;page-break-inside:avoid;break-inside:avoid}
    .doc-option-title{margin:0 0 12px;font-size:1.15rem;color:var(--accent);font-weight:700}
    .doc-option-desc-label{margin:0 0 6px;font-size:.9rem}
    .doc-option-desc{margin:0 0 16px;color:#39465b;font-size:.9rem;line-height:1.5}
    .doc-table-label{margin:12px 0 6px;font-size:.9rem}

    .doc-cost-table,.doc-summary-table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:.88rem;page-break-inside:avoid;break-inside:avoid}
    .doc-cost-table td,.doc-summary-table td{padding:8px 0;border-bottom:1px solid #e4e8f0}
    .doc-cost-table td:last-child,.doc-summary-table td:last-child{text-align:right;font-weight:600}
    .doc-summary-table th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#344054;border-bottom:2px solid #d8deea;padding:10px 0;font-weight:700}
    .doc-summary-table th:nth-child(n+2){text-align:right}
    .doc-summary-table td:nth-child(n+2){text-align:right}

    .doc-acconto-section{margin:12px 0;padding:12px 16px;background:#fff;border:1px solid #e0e5ee;border-radius:8px;font-size:.88rem;color:#39465b}
    .doc-acconto-section p{margin:0}
    .doc-acconto-section strong{color:var(--accent)}

    .doc-clauses-section{margin:36px 0;padding-top:24px;border-top:1px solid #d7deea;page-break-inside:avoid;break-inside:avoid}
    .doc-clauses-title{margin:0 0 20px;font-size:1.3rem;font-weight:700;letter-spacing:-.02em}
    .doc-clause{margin-bottom:16px;page-break-inside:avoid;break-inside:avoid}
    .doc-clause p{margin:0;font-size:.9rem;color:#39465b;line-height:1.6}
    .doc-clause strong{color:#101828}

    .doc-comparison-section{margin:36px 0;padding-top:24px;border-top:1px solid #d7deea;page-break-inside:avoid;break-inside:avoid}
    .doc-comparison-title{margin:0 0 16px;font-size:1.3rem;font-weight:700;letter-spacing:-.02em}
    .doc-comparison-table{width:100%;border-collapse:collapse;font-size:.85rem;table-layout:fixed;page-break-inside:avoid;break-inside:avoid}
    .doc-comparison-table th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#344054;border-bottom:2px solid #d8deea;padding:10px 8px;font-weight:700}
    .doc-comparison-table td{padding:10px 8px;border-bottom:1px solid #e4e8f0;overflow:hidden;text-overflow:ellipsis}
    .doc-comparison-table td:first-child{font-weight:700;color:#101828}
    .doc-comparison-table tr{display:table-row}
    .doc-comparison-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -48px;padding:0 48px}

    .doc-footer{display:flex;justify-content:space-between;padding-top:24px;border-top:1px solid #d7deea;font-size:.85rem;color:#687589}

    /* ─── COLLECTION ────────────────────────────────── */
    .collection-view{padding:28px}
    .collection-head{margin-bottom:24px}
    .collection-head p{margin:0 0 4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);font-weight:900}
    .collection-head h2{margin:0 0 8px;font-size:clamp(1.65rem,3vw,2.45rem);letter-spacing:-.055em;line-height:1}
    .collection-head span{color:var(--muted);font-size:.88rem}
    .collection-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
    .collection-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:grid;gap:12px;box-shadow:0 2px 12px rgba(19,35,58,.04);transition:transform .15s,box-shadow .15s,border-color .15s}
    .collection-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(19,35,58,.08);border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .collection-card.active{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
    .collection-card h3{margin:0;font-size:1.05rem;font-weight:800;letter-spacing:-.02em}
    .collection-card p{margin:0;color:var(--muted);font-size:.88rem}
    .card-top{display:flex;justify-content:space-between;align-items:center}
    .card-top span{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;font-weight:800;padding:4px 8px;border-radius:6px}
    .status-dropdown{border-radius:6px;overflow:hidden}
    .status-dropdown select{border:none;border-radius:6px;padding:4px 20px 4px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;font-weight:800;cursor:pointer;appearance:auto;-webkit-appearance:auto;outline:none}
    .status-dropdown select:focus{box-shadow:none}
    .card-top span.bozza{background:#f0f1f5;color:#666c7c}
    .card-top span.inviato{background:#e6eefc;color:var(--accent)}
    .card-top span.accettato{background:#f7eddc;color:var(--amber)}
    .card-top b{font-size:.75rem;color:var(--muted);font-weight:500}
    .card-meta{display:flex;justify-content:space-between;align-items:center}
    .card-meta span{color:var(--muted);font-size:.82rem}
    .card-meta strong{font-size:1.05rem;color:var(--accent);font-weight:800}
    .card-actions{display:flex;gap:6px}
    .card-actions button{flex:1;font-size:.75rem;padding:7px 10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:8px}
    .card-actions button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

    /* ─── RESPONSIVE ────────────────────────────────── */
    @media(max-width:1400px){.editor-grid{grid-template-columns:300px 300px 1fr}}
    @media(max-width:1200px){.editor-grid{grid-template-columns:1fr 1fr}.preview-wrap{display:none}}
    @media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{display:none}.editor-grid{grid-template-columns:1fr}.preview-wrap{display:block;min-height:60vh}}
    @media(max-width:680px){.topbar{padding:0 16px}.form-grid{grid-template-columns:1fr}.swatches{grid-template-columns:repeat(5,1fr)}.document{padding:24px;font-size:.85rem}.doc-footer{flex-direction:column;gap:8px}.collection-grid{grid-template-columns:1fr}.option-editor .mini-row{grid-template-columns:1fr}.doc-cost-table,.doc-summary-table{font-size:.78rem}.doc-comparison-table{font-size:.75rem}}
  `}</style>;
}
