export default function GlobalStyles() {
  return <style>{`
    :root{
      --accent:#0B57D0;
      --sidebar:#082033;
      --canvas:#F6F8FC;
      --ink:#07111f;
      --ink-sec:#344054;
      --muted:#647086;
      --muted-lt:#94a3b8;
      --line:#c8d0df;
      --line-lt:#f1f5f9;
      --surface:#fff;
      --surface-sun:#f8fafc;
      --surface-hov:#f1f5f9;
      --green:#11845b;
      --amber:#a66200;
      --red:#dc2626;
      --red-bg:#fef2f2;
      --red-border:#fca5a5;
      --green-bg:#f0fdf4;
      --green-border:#bbf7d0;
      --blue-bg:#e8f0fe;
      --blue-border:#b8d6ff;
      --info-bg:#f0f7ff;
      --info-border:#b8d6ff;
      --info-text:#1e4a7a;
      --overlay:rgba(0,0,0,.3);
      --shadow-sm:0 2px 12px rgba(19,35,58,.04);
      --shadow-md:0 8px 24px rgba(19,35,58,.08);
      --shadow-lg:0 20px 60px rgba(0,0,0,.15);

      /* Spacing scale */
      --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px;
      --space-5:20px; --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px;

      /* Border radius scale */
      --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-xl:20px; --radius-full:9999px;

      /* Font weight scale */
      --weight-normal:400; --weight-medium:500; --weight-semibold:600;
      --weight-bold:700; --weight-extrabold:800; --weight-black:900;

      /* Transition defaults */
      --transition-fast:0.15s ease;
      --transition-base:0.2s ease;
      --transition-slow:0.3s ease;

      /* Glassmorphism defaults */
      --glass-bg:rgba(255,255,255,0.75);
      --glass-border:rgba(255,255,255,0.18);
      --glass-blur:20px;
    }
    [data-theme="dark"]{
      --accent:#4d94ff;
      --sidebar:#082033;
      --canvas:#0f1117;
      --ink:#e8eaf0;
      --ink-sec:#c0c4d0;
      --muted:#8892a8;
      --muted-lt:#5a6178;
      --line:#2d3044;
      --line-lt:#1e2030;
      --surface:#1a1d27;
      --surface-sun:#14161f;
      --surface-hov:#22263a;
      --green:#22c55e;
      --amber:#f59e0b;
      --red:#f87171;
      --red-bg:rgba(248,113,113,.1);
      --red-border:rgba(248,113,113,.2);
      --green-bg:rgba(34,197,94,.1);
      --green-border:rgba(34,197,94,.2);
      --blue-bg:rgba(77,148,255,.08);
      --blue-border:rgba(77,148,255,.15);
      --info-bg:rgba(77,148,255,.08);
      --info-border:rgba(77,148,255,.15);
      --info-text:#8ab4f8;
      --overlay:rgba(0,0,0,.6);
      --shadow-sm:0 2px 12px rgba(0,0,0,.2);
      --shadow-md:0 8px 24px rgba(0,0,0,.3);
      --shadow-lg:0 20px 60px rgba(0,0,0,.4);
      --glass-bg:rgba(26,29,39,0.85);
      --glass-border:rgba(255,255,255,0.06);
    }

    [data-theme="dark"] body{background:linear-gradient(135deg,#0f1117,#1a1d27 54%,#151821);color:var(--ink)}
    [data-theme="dark"] button{background:var(--surface);color:var(--ink);border-color:var(--line)}
    [data-theme="dark"] .admin-stat b{color:#4d94ff}
    [data-theme="dark"] .admin-stat span{color:#8892a8}
    [data-theme="dark"] input,[data-theme="dark"] textarea,[data-theme="dark"] select{background:var(--surface);color:var(--ink);border-color:var(--line)}
    [data-theme="dark"] select option{background:var(--surface);color:var(--ink)}

    *{box-sizing:border-box}html{background:var(--canvas);overflow-x:hidden}
    body{margin:0;overflow-x:hidden;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,var(--canvas),#eef3fb 54%,#ffffff);color:var(--ink)}
    button,input,textarea{font:inherit}
    button{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-md);padding:.72rem .9rem;cursor:pointer;font-weight:var(--weight-extrabold);color:var(--ink);transition:transform var(--transition-fast),box-shadow var(--transition-fast),border-color var(--transition-fast)}
    button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(8,32,51,.09)}
    button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 35%,transparent);outline-offset:2px}
    input,textarea{width:100%;border:1px solid var(--line);border-radius:var(--radius-md);padding:.82rem;background:var(--surface);color:var(--ink);transition:border-color var(--transition-base),box-shadow var(--transition-base)}
    input:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
    textarea{min-height:84px;resize:vertical;line-height:1.45}
    label{display:grid;gap:.45rem;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:var(--weight-black);color:var(--muted)}
    select{appearance:auto;-webkit-appearance:auto;border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;background:var(--surface);color:var(--ink);font-weight:var(--weight-semibold);cursor:pointer;transition:border-color var(--transition-fast)}
    select:focus{border-color:var(--accent);outline:none}
    input[type="checkbox"]{width:auto;height:auto;border-radius:var(--radius-sm);accent-color:var(--accent);cursor:pointer}

    /* Glassmorphism utility */
    .glass{background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur));border:1px solid var(--glass-border)}

    /* Entry animations */
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
    @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

    .enter-anim{animation:fadeSlideUp .35s ease-out both}
    .enter-anim-delay-1{animation-delay:.05s}
    .enter-anim-delay-2{animation-delay:.1s}
    .enter-anim-delay-3{animation-delay:.15s}

    /* ─── APP SHELL ─────────────────────────────────── */
    .app-shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}

    /* ─── SIDEBAR ───────────────────────────────────── */
    .sidebar{background:radial-gradient(circle at 10% 0%,rgba(255,255,255,.12),transparent 40%),linear-gradient(180deg,#0a1929 0%,#082033 100%);color:#fff;padding:24px 20px;display:flex;flex-direction:column;gap:24px;border-right:1px solid rgba(255,255,255,.06)}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--radius-md);background:linear-gradient(135deg,var(--accent),#3b82f6);color:#fff;flex-shrink:0}
    .brand strong{display:block;font-size:.95rem;font-weight:var(--weight-extrabold);letter-spacing:-.02em}
    .brand small{display:block;color:#8896ab;margin-top:2px;font-size:.78rem}
    .sidebar nav{display:grid;gap:4px}
    .sidebar nav button{display:flex;align-items:center;gap:10px;background:transparent;color:#8896ab;border:none;border-radius:10px;padding:10px 14px;text-align:left;font-size:.88rem;font-weight:var(--weight-semibold);transition:all var(--transition-fast)}
    .sidebar nav button svg{flex-shrink:0;opacity:.6;transition:opacity var(--transition-fast)}
    .sidebar nav button:hover{background:rgba(255,255,255,.06);color:#cfe0f2;transform:none;box-shadow:none}
    .sidebar nav button:hover svg{opacity:.9}
    .sidebar nav button.active{background:rgba(255,255,255,.1);color:#fff;font-weight:var(--weight-bold)}
    .sidebar nav button.active svg{opacity:1;color:var(--accent)}
    .side-card{background:rgba(255,255,255,.05);border-radius:14px;padding:16px;border:1px solid rgba(255,255,255,.06)}
    .side-user{display:flex;align-items:center;gap:12px}
    .side-avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.08);display:grid;place-items:center;flex-shrink:0;color:#8896ab}
    .side-card b{display:block;font-size:.85rem;font-weight:var(--weight-bold);margin-bottom:2px}
    .side-card p{margin:0;font-size:.78rem;color:#8896ab;line-height:1.4}
    .side-card .logout-btn,.side-card .login-link{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);color:#a4b3cc;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;margin-top:10px;text-decoration:none;font-size:.78rem;font-weight:var(--weight-semibold);transition:all var(--transition-fast);width:100%;cursor:pointer}
    .side-card .logout-btn:hover,.side-card .login-link:hover{background:rgba(255,255,255,.1);color:#fff;transform:none;box-shadow:none}
    .side-utility{display:grid;gap:6px}

    /* ─── WORKSPACE / TOPBAR ────────────────────────── */
    .workspace{display:flex;flex-direction:column;min-height:100vh}
    .topbar{height:68px;border-bottom:1px solid var(--line);background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur));display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:5}
    [data-theme="dark"] .topbar{background:rgba(15,17,23,.85);border-bottom-color:var(--line)}
    .topbar p{margin:0;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:var(--weight-extrabold)}
    .topbar h1{margin:0;font-size:1.25rem;font-weight:var(--weight-black);letter-spacing:-.03em}
    .top-actions{display:flex;gap:8px}
    .top-actions button{display:flex;align-items:center;gap:7px;font-size:.85rem;padding:9px 16px;border-radius:10px;font-weight:var(--weight-bold)}
    .top-actions button svg{flex-shrink:0}
    .top-btn-save{background:var(--surface);color:var(--ink);border:1px solid var(--line)}
    .top-btn-save:hover{border-color:var(--accent);color:var(--accent)}
    .top-btn-export{background:var(--accent);color:#fff;border:1px solid color-mix(in srgb,var(--accent) 80%,#000);box-shadow:0 2px 8px color-mix(in srgb,var(--accent) 20%,transparent)}
    .top-btn-export:hover{background:color-mix(in srgb,var(--accent) 90%,#000);box-shadow:0 4px 16px color-mix(in srgb,var(--accent) 30%,transparent)}
    .top-btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
    .top-btn-ghost:hover{color:var(--ink);border-color:var(--accent)}

    /* ─── EDITOR GRID ───────────────────────────────── */
    .editor-grid{display:flex;flex:1;overflow:hidden;min-height:0}
    .editor-col{width:380px;flex-shrink:0;position:relative;transition:width .25s ease;overflow:hidden}
    .editor-col.collapsed{width:34px;overflow:visible}
    .panel{overflow-y:auto;padding:24px;border-right:1px solid var(--line);height:100%;min-width:0;background:var(--surface)}
    .panel-kicker{font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);font-weight:var(--weight-black);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
    .panel-toggle{background:none;border:none;padding:3px;color:var(--muted);cursor:pointer;border-radius:4px;display:grid;place-items:center;transition:background var(--transition-fast),color var(--transition-fast);width:26px;height:26px}
    .panel-toggle:hover{background:var(--surface-hov);color:var(--ink)}
    .panel-tab{width:34px;height:100%;background:var(--surface);border-right:1px solid var(--line);cursor:pointer;display:flex;flex-direction:column;align-items:center;padding-top:20px;gap:4px;font-size:.5rem;font-weight:var(--weight-extrabold);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);transition:color var(--transition-fast),background var(--transition-fast)}
    .panel-tab:hover{color:var(--accent);background:var(--surface-sun)}
    .panel-tab svg{flex-shrink:0}
    .panel h2{margin:0 0 8px;font-size:1rem;font-weight:var(--weight-black);letter-spacing:-.02em}
    .panel p{margin:0 0 12px;font-size:.82rem;color:var(--muted);line-height:1.5}
    .ai-panel textarea{min-height:80px}
    .api-key-section{margin:0 0 12px;padding:10px;background:var(--surface-sun);border-radius:10px;border:1px solid var(--line);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .ai-model-selector{display:flex;align-items:center;gap:6px}
    .ai-model-selector label{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;font-weight:var(--weight-extrabold);color:var(--muted)}
    .ai-model-selector select{padding:4px 8px;border:1px solid var(--line);border-radius:6px;font-size:.78rem;font-weight:var(--weight-semibold);color:var(--ink);background:var(--surface);cursor:pointer;outline:none;transition:border-color var(--transition-fast)}
    .ai-model-selector select:focus{border-color:var(--accent)}
    .api-key-label{display:grid;gap:4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;font-weight:var(--weight-extrabold);color:var(--muted)}
    .api-key-input{font-size:.82rem!important;padding:.6rem!important;font-family:monospace}
    .api-key-status{font-size:.72rem;font-weight:var(--weight-bold);margin-top:4px;display:block}
    .api-key-status.ok{color:var(--green)}
    .api-key-status.no{color:var(--amber)}
    .ai-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
    .ai-actions button{font-size:.75rem;padding:6px 10px}
    .primary.wide{width:100%;background:var(--accent);color:#fff;border-color:color-mix(in srgb,var(--accent) 82%,#052258);margin-top:6px}
    .activity-log{margin-top:12px;padding:10px;background:var(--surface-sun);border-radius:10px;border:1px solid var(--line)}
    .activity-log span{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:var(--weight-extrabold);margin-bottom:4px}
    .activity-log b{display:block;font-size:.78rem;color:var(--ink)}

    .ai-log-panel{margin-top:12px;padding:10px;background:#0f172a;border-radius:10px;border:1px solid #1e293b;max-height:200px;overflow-y:auto;font-family:'JetBrains Mono',monospace;font-size:.7rem}
    .ai-log-title{display:block;font-size:.65rem;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:var(--weight-bold);margin-bottom:6px}
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
    .collapsible{border:1px solid var(--line);border-radius:10px;margin-bottom:10px;overflow:hidden;background:var(--surface)}
    .collapsible-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer;user-select:none;transition:background var(--transition-fast);gap:8px}
    .collapsible-head:hover{background:var(--surface-sun)}
    .collapsible-head span{font-size:.82rem;font-weight:var(--weight-bold);color:var(--ink)}
    .collapsible-head-right{display:flex;align-items:center;gap:6px}
    .collapsible-chevron{transition:transform var(--transition-base);color:var(--muted);flex-shrink:0}
    .collapsible.open .collapsible-chevron{transform:rotate(180deg)}
    .collapsible-body{padding:0 14px 12px;border-top:1px solid var(--line)}
    .btn-add{padding:3px 10px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:.72rem;font-weight:var(--weight-bold);cursor:pointer;white-space:nowrap;transition:background var(--transition-fast)}
    .btn-add:hover{background:var(--blue-bg)}
    .control-block{margin-bottom:20px;border-top:1px solid var(--line);padding-top:16px}
    .control-block h3{margin:0 0 10px;font-size:.88rem;font-weight:var(--weight-black)}
    .swatches{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
    .swatches button{width:36px;height:36px;border-radius:50%;border:3px solid transparent;padding:0;transition:transform var(--transition-fast),box-shadow var(--transition-fast)}
    .swatches button:hover{transform:scale(1.15)}
    .swatches button.selected{border-color:var(--ink);box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--ink);transform:scale(1.1)}

    .option-editor{border:1px solid var(--line);border-radius:var(--radius-md);padding:14px;background:var(--surface);margin-bottom:10px;display:grid;gap:8px;transition:border-color var(--transition-fast)}
    .option-editor:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .option-title-input{font-weight:var(--weight-extrabold);font-size:.92rem}
    .option-editor .mini-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}
    .option-editor .mini-row label{display:grid;gap:4px;font-size:.7rem}
    .checkbox-label{display:flex!important;align-items:center;gap:6px;font-size:.78rem;text-transform:none;letter-spacing:0;font-weight:var(--weight-bold);color:var(--ink);cursor:pointer;white-space:nowrap}
    .checkbox-label input[type="checkbox"]{width:auto;height:auto;border-radius:4px}
    .btn-remove{font-size:.75rem;padding:6px 10px;color:var(--red);border-color:var(--red-border);background:transparent}
    .btn-remove:hover{background:var(--red-bg);border-color:var(--red);color:var(--red);transform:none;box-shadow:none}

    .clause-editor{border:1px solid var(--line);border-radius:var(--radius-md);padding:14px;background:var(--surface);margin-bottom:10px;display:grid;gap:8px;transition:border-color var(--transition-fast)}
    .clause-editor:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .clause-editor button{font-size:.75rem;padding:6px 10px;color:var(--red);border-color:var(--red-border)}
    .clause-editor button:hover{background:var(--red-bg);border-color:var(--red);color:var(--red);transform:none;box-shadow:none}

    /* ─── DOCUMENT THEME VARIABLES ──────────────────── */
    .doc-theme-minimal{--doc-font-family:'Inter',system-ui,sans-serif;--doc-font-family-display:'Inter',system-ui,sans-serif;--doc-color-primary:#1a1a2e;--doc-color-accent:#01696F;--doc-color-border:#e5e7eb;--doc-color-header-bg:#ffffff;--doc-color-header-text:#1a1a2e;--doc-color-background:#ffffff;--doc-color-surface:#f8f9fa;--doc-bdrs:0;--doc-shadow:none}
    .doc-theme-corporate{--doc-font-family:'Inter',system-ui,sans-serif;--doc-font-family-display:'Inter',system-ui,sans-serif;--doc-color-primary:#1a1a2e;--doc-color-accent:#01696F;--doc-color-border:#d1d5db;--doc-color-header-bg:#1a1a2e;--doc-color-header-text:#ffffff;--doc-color-background:#ffffff;--doc-color-surface:#f4f5f7;--doc-bdrs:4px;--doc-shadow:0 1px 3px rgba(0,0,0,0.08)}
    .doc-theme-creative{--doc-font-family:'Inter',system-ui,sans-serif;--doc-font-family-display:'Source Serif 4',Georgia,serif;--doc-color-primary:#01696F;--doc-color-accent:#f59e0b;--doc-color-border:#e5e7eb;--doc-color-header-bg:linear-gradient(135deg,#01696F,#0d9488);--doc-color-header-text:#ffffff;--doc-color-background:#fafafa;--doc-color-surface:#ffffff;--doc-bdrs:12px;--doc-shadow:0 4px 16px rgba(1,105,111,0.1)}

    /* ─── PREVIEW ───────────────────────────────────── */
    .preview-wrap{flex:1;min-width:0;overflow:auto;padding:28px;background:var(--line-lt)}

    /* Document base styles */
    .document{width:min(100%,794px);max-width:100%;margin:0 auto;background:var(--doc-color-background,#fff);color:#101828;box-shadow:0 24px 80px rgba(35,44,62,.12);border:1px solid #d7deea;padding:48px;font-family:var(--doc-font-family,Georgia,'Times New Roman',serif);line-height:1.6;overflow-x:auto;word-wrap:break-word}
    .doc-title-section{margin-bottom:32px}
    .doc-main-title{margin:0 0 20px;font-size:2rem;letter-spacing:-.03em;font-weight:var(--weight-bold);color:var(--accent)}
    .doc-client-info{border-top:1px solid #d7deea;padding-top:16px}
    .doc-client-info p{margin:4px 0;font-size:.95rem}
    .doc-intro-text{margin:24px 0;padding:16px 0;border-top:1px solid #d7deea;border-bottom:1px solid #d7deea}
    .doc-intro-text p{margin:0;color:#39465b;font-size:.92rem;line-height:1.6}

    .doc-option{margin:32px 0;padding:20px;border:1px solid var(--doc-color-border,#e0e5ee);background:var(--doc-color-surface,#f8fafd);border-radius:var(--doc-bdrs,14px);page-break-inside:avoid;break-inside:avoid}
    .doc-option-title{margin:0 0 12px;font-size:1.15rem;color:var(--accent);font-weight:var(--weight-bold)}
    .doc-option-desc-label{margin:0 0 6px;font-size:.9rem}
    .doc-option-desc{margin:0 0 16px;color:#39465b;font-size:.9rem;line-height:1.5}
    .doc-table-label{margin:12px 0 6px;font-size:.9rem}

    .doc-cost-table,.doc-summary-table{width:100%;min-width:520px;border-collapse:collapse;margin:8px 0 16px;font-size:.88rem;page-break-inside:avoid;break-inside:avoid;border-radius:var(--doc-bdrs,6px);box-shadow:var(--doc-shadow,0 1px 3px rgba(0,0,0,0.05))}
    .doc-cost-table thead,.doc-summary-table thead{background:var(--doc-color-header-bg,var(--sidebar,#082033));color:var(--doc-color-header-text,#fff)}
    .doc-cost-table th,.doc-summary-table th{text-align:left;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;padding:12px 14px;font-weight:var(--weight-bold);color:var(--doc-color-header-text,#fff);border:none}
    .doc-cost-table th:nth-child(n+2),.doc-summary-table th:nth-child(n+2){text-align:right}
    .doc-cost-table td,.doc-summary-table td{padding:10px 14px;border-bottom:1px solid #e4e8f0}
    .doc-cost-table tbody tr:nth-child(even),.doc-summary-table tbody tr:nth-child(even){background:var(--doc-color-surface,#f8fafc)}
    .doc-cost-table td:last-child,.doc-summary-table td:last-child{text-align:right;font-weight:var(--weight-semibold)}
    .doc-summary-table td:nth-child(n+2){text-align:right}

    .doc-callout-warning{background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;color:#78350f;border-radius:0 6px 6px 0;font-size:0.9rem}
    .doc-callout-info{background-color:#f0fdf4;border-left:4px solid #10b981;padding:12px 16px;margin:12px 0;color:#064e3b;border-radius:0 6px 6px 0;font-size:0.9rem}

    .doc-acconto-section{margin:12px 0;padding:12px 16px;background:#fff;border:1px solid #e0e5ee;border-radius:8px;font-size:.88rem;color:#39465b}
    .doc-acconto-section p{margin:0}
    .doc-acconto-section strong{color:var(--accent)}

    .doc-clauses-section{margin:36px 0;padding-top:24px;border-top:1px solid #d7deea;page-break-inside:avoid;break-inside:avoid}
    .doc-clauses-title{margin:0 0 20px;font-size:1.3rem;font-weight:var(--weight-bold);letter-spacing:-.02em}
    .doc-clause{margin-bottom:16px;page-break-inside:avoid;break-inside:avoid}
    .doc-clause p{margin:0;font-size:.9rem;color:#39465b;line-height:1.6}
    .doc-clause strong{color:#101828}

    .doc-comparison-section{margin:36px 0;padding-top:24px;border-top:1px solid #d7deea;page-break-inside:avoid;break-inside:avoid}
    .doc-comparison-title{margin:0 0 16px;font-size:1.3rem;font-weight:var(--weight-bold);letter-spacing:-.02em}
    .doc-comparison-table{width:100%;border-collapse:collapse;font-size:.85rem;table-layout:fixed;page-break-inside:avoid;break-inside:avoid}
    .doc-comparison-table th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:#344054;border-bottom:2px solid #d8deea;padding:10px 8px;font-weight:var(--weight-bold)}
    .doc-comparison-table td{padding:10px 8px;border-bottom:1px solid #e4e8f0;overflow:hidden;text-overflow:ellipsis}
    .doc-comparison-table td:first-child{font-weight:var(--weight-bold);color:#101828}
    .doc-comparison-table tr{display:table-row}
    .doc-comparison-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -48px;padding:0 48px}
    @media(max-width:768px){.doc-comparison-wrap{margin:0;padding:0}}

    .doc-footer{display:flex;justify-content:space-between;padding-top:24px;border-top:1px solid #d7deea;font-size:.85rem;color:#687589}

    /* ─── COLLECTION ────────────────────────────────── */
    .collection-view{padding:28px;animation:fadeSlideUp .35s ease-out both}
    .collection-head{margin-bottom:24px}
    .collection-head p{margin:0 0 4px;font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);font-weight:var(--weight-black)}
    .collection-head h2{margin:0 0 8px;font-size:clamp(1.65rem,3vw,2.45rem);letter-spacing:-.055em;line-height:1}
    .collection-head span{color:var(--muted);font-size:.88rem}
    .collection-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
    .collection-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;display:grid;gap:12px;box-shadow:var(--shadow-sm);transition:transform var(--transition-fast),box-shadow var(--transition-fast),border-color var(--transition-fast)}
    .collection-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:color-mix(in srgb,var(--accent) 30%,var(--line))}
    .collection-card.active{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent)}
    .collection-card h3{margin:0;font-size:1.05rem;font-weight:var(--weight-extrabold);letter-spacing:-.02em;color:var(--ink)}
    .collection-card p{margin:0;color:var(--muted);font-size:.88rem}
    .card-top{display:flex;justify-content:space-between;align-items:center}
    .card-top span{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;font-weight:var(--weight-extrabold);padding:4px 8px;border-radius:6px}
    .status-dropdown{border-radius:6px;overflow:hidden}
    .status-dropdown select{border:none;border-radius:6px;padding:4px 20px 4px 8px;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;font-weight:var(--weight-extrabold);cursor:pointer;appearance:auto;-webkit-appearance:auto;outline:none}
    .status-dropdown select:focus{box-shadow:none}
    .card-top span.bozza{background:var(--surface-hov);color:var(--muted)}
    .card-top span.inviato{background:var(--blue-bg);color:var(--accent)}
    .card-top span.accettato{background:#f7eddc;color:var(--amber)}
    .card-top span.rifiutato{background:var(--red-bg);color:var(--red)}
    .card-top b{font-size:.75rem;color:var(--muted);font-weight:500}
    .card-meta{display:flex;justify-content:space-between;align-items:center}
    .card-meta span{color:var(--muted);font-size:.82rem}
    .card-meta strong{font-size:1.05rem;color:var(--accent);font-weight:var(--weight-extrabold)}
    .card-actions{display:flex;gap:6px}
    .card-actions button{flex:1;font-size:.75rem;padding:7px 10px;display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:8px}
    .card-actions button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

    .collection-tabs{display:flex;gap:0;margin-bottom:20px;border:1px solid var(--line);border-radius:10px;overflow:hidden;width:fit-content}
    .collection-tabs button{border:none;border-radius:0;padding:10px 20px;font-size:.85rem;font-weight:var(--weight-bold);cursor:pointer;background:transparent;color:var(--muted);transition:all var(--transition-fast)}
    .collection-tabs button.active{background:var(--accent);color:#fff}

    /* ─── THEME SELECTOR CARDS ──────────────────────── */
    .theme-selector{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}
    .theme-card{border:2px solid var(--line);border-radius:var(--radius-md);padding:12px;cursor:pointer;text-align:center;transition:border-color var(--transition-fast),background var(--transition-fast);background:var(--surface)}
    .theme-card:hover{border-color:var(--accent);background:var(--surface-sun)}
    .theme-card.selected{border-color:var(--accent);background:var(--blue-bg)}
    .theme-card .theme-preview{width:100%;height:40px;border-radius:4px;margin-bottom:6px;display:grid;place-items:center;font-size:.6rem;font-weight:var(--weight-bold);text-transform:uppercase;letter-spacing:.05em}
    .theme-card .theme-name{font-size:.72rem;font-weight:var(--weight-bold);color:var(--ink)}
    .theme-card .theme-desc{font-size:.65rem;color:var(--muted);margin-top:2px}
    .theme-preview-minimal{background:#fff;border:1px solid #e5e7eb;color:#1a1a2e}
    .theme-preview-corporate{background:#1a1a2e;color:#fff}
    .theme-preview-creative{background:linear-gradient(135deg,#01696F,#0d9488);color:#fff}

    /* ─── MOBILE TOPBAR ──────────────────────────────── */
    .mobile-topbar{display:none;position:sticky;top:0;z-index:50;height:56px;background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur));color:var(--ink);align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--line)}
    [data-theme="dark"] .mobile-topbar{background:rgba(15,17,23,.9)}
    .mobile-hamburger{background:none;border:none;color:var(--ink);padding:8px;display:grid;place-items:center;cursor:pointer;border-radius:8px;transition:background var(--transition-fast);width:40px;height:40px}
    .mobile-hamburger:hover{background:var(--surface-hov);transform:none;box-shadow:none}
    .mobile-brand{font-size:1rem;font-weight:var(--weight-extrabold);letter-spacing:-.02em;position:absolute;left:50%;transform:translateX(-50%)}
    .mobile-logout-btn{background:none;border:none;color:var(--muted);display:flex;align-items:center;gap:4px;padding:6px 10px;cursor:pointer;border-radius:8px;font-size:.78rem;font-weight:var(--weight-semibold);transition:color var(--transition-fast),background var(--transition-fast);flex-shrink:0}
    .mobile-logout-btn:hover{color:var(--ink);background:var(--surface-hov);transform:none;box-shadow:none}
    .mobile-logout-btn svg{flex-shrink:0}
    .mobile-theme-btn{background:none;border:none;color:var(--ink);padding:8px;display:grid;place-items:center;cursor:pointer;border-radius:8px;transition:background var(--transition-fast);font-size:1.1rem;line-height:1;flex-shrink:0;min-width:40px;min-height:40px}
    .mobile-theme-btn:hover{background:var(--surface-hov);transform:none;box-shadow:none}
    .mobile-theme-btn:active{background:var(--blue-bg);transform:none}
    .mobile-save-btn{background:none;border:none;color:var(--ink);padding:8px;display:grid;place-items:center;cursor:pointer;border-radius:8px;transition:background var(--transition-fast);flex-shrink:0;min-width:40px;min-height:40px}
    .mobile-save-btn:hover{background:var(--surface-hov);transform:none;box-shadow:none}
    .mobile-save-btn:active{background:var(--blue-bg);transform:none}

    /* ─── DRAWER ──────────────────────────────────────── */
    .drawer-overlay{position:fixed;inset:0;background:var(--overlay);z-index:100;animation:fadeIn .2s ease}
    .mobile-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;max-width:85vw;background:radial-gradient(circle at 10% 0%,rgba(255,255,255,.12),transparent 40%),linear-gradient(180deg,#0a1929 0%,#082033 100%);color:#fff;display:flex;flex-direction:column;padding:20px;animation:slideIn .25s ease;z-index:101;overflow-y:auto}
    .drawer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .drawer-close{background:none;border:none;color:#8896ab;padding:6px;cursor:pointer;border-radius:8px;display:grid;place-items:center;transition:color var(--transition-fast),background var(--transition-fast)}
    .drawer-close:hover{color:#fff;background:rgba(255,255,255,.1);transform:none;box-shadow:none}
    .drawer-nav{display:grid;gap:4px;flex:1}
    .drawer-nav button{display:flex;align-items:center;gap:12px;background:transparent;color:#8896ab;border:none;border-radius:10px;padding:12px 14px;text-align:left;font-size:.95rem;font-weight:var(--weight-semibold);cursor:pointer;transition:all var(--transition-fast)}
    .drawer-nav button svg{flex-shrink:0;opacity:.6;transition:opacity var(--transition-fast);width:20px;height:20px}
    .drawer-nav button:hover{background:rgba(255,255,255,.06);color:#cfe0f2;transform:none;box-shadow:none}
    .drawer-nav button:hover svg{opacity:.9}
    .drawer-nav button.active{background:rgba(255,255,255,.1);color:#fff;font-weight:var(--weight-bold)}
    .drawer-nav button.active svg{opacity:1;color:var(--accent)}
    .drawer-footer{border-top:1px solid rgba(255,255,255,.08);padding-top:16px;margin-top:16px;display:grid;gap:8px}
    .drawer-user{display:flex;align-items:center;gap:10px;font-size:.82rem;color:#8896ab;padding:8px 4px}
    .drawer-user svg{flex-shrink:0;opacity:.6}
    .drawer-logout{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.05);color:#a4b3cc;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 14px;font-size:.85rem;font-weight:var(--weight-semibold);cursor:pointer;transition:all var(--transition-fast);width:100%}
    .drawer-logout:hover{background:rgba(255,255,255,.1);color:#fff;transform:none;box-shadow:none}

    /* ─── EDITOR MOBILE INLINE ────────────────────────── */
    .editor-mobile-bar{display:none}
    .editor-mobile-panel{display:none}

    /* ─── PDF IMPORT MODAL ──────────────────────────── */
    .pdf-import-overlay{position:fixed;inset:0;background:var(--overlay);z-index:500;display:grid;place-items:center;padding:20px;animation:fadeIn .2s}
    .pdf-import-modal{background:var(--surface);border-radius:var(--radius-xl);width:100%;max-width:960px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .3s ease-out}
    .pdf-import-header{display:flex;justify-content:space-between;align-items:center;padding:24px 28px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur));z-index:1}
    .pdf-import-header h2{margin:0;font-size:1.15rem;font-weight:var(--weight-black)}
    .pdf-import-body{padding:28px}
    .pdf-import-step{display:flex;gap:8px;margin-bottom:20px;justify-content:center}
    .pdf-import-step span{width:28px;height:28px;border-radius:50%;background:var(--line-lt);color:var(--muted);display:grid;place-items:center;font-size:.72rem;font-weight:var(--weight-bold)}
    .pdf-import-step span.active{background:var(--accent);color:#fff}
    .pdf-import-step span.done{background:var(--green);color:#fff}
    .pdf-import-step .step-line{width:40px;height:1px;background:var(--line);align-self:center}
    .dropzone{border:2px dashed var(--line);border-radius:var(--radius-lg);padding:48px 24px;text-align:center;cursor:pointer;transition:border-color var(--transition-fast),background var(--transition-fast)}
    .dropzone:hover,.dropzone.drag-over{border-color:var(--accent);background:var(--blue-bg)}
    .dropzone svg{margin-bottom:12px;color:var(--muted)}
    .dropzone p{margin:0 0 4px;font-size:.95rem;font-weight:var(--weight-bold);color:var(--ink)}
    .dropzone small{color:var(--muted);font-size:.82rem}
    .pdf-preview-split{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .pdf-preview-col{max-height:400px;overflow-y:auto;padding:16px;background:var(--surface-sun);border-radius:var(--radius-md);border:1px solid var(--line);font-size:.82rem;line-height:1.6;white-space:pre-wrap;font-family:monospace}
    .pdf-preview-col h4{margin:0 0 8px;font-size:.82rem;font-weight:var(--weight-bold);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}

    /* ─── RESPONSIVE ────────────────────────────────── */
    @media(max-width:1400px){.editor-col{width:320px}}
    @media(max-width:1200px){.editor-col{width:280px}.preview-wrap{padding:20px}}
    @media(max-width:1023px){.collection-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{display:none}.preview-wrap{min-height:60vh;overflow-x:hidden}.top-actions{flex-wrap:wrap;gap:6px}.top-actions button span{display:none}}
    @media(max-width:768px){
      .mobile-topbar{display:flex}
      .editor-grid{flex-direction:column;overflow:visible}
      .editor-col{display:none}
      .editor-mobile-bar{display:flex;flex-shrink:0;background:var(--surface);border-bottom:1px solid var(--line)}
      .editor-mobile-bar button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:0;background:var(--surface);color:var(--muted);font-size:.82rem;font-weight:var(--weight-bold);cursor:pointer;padding:12px;transition:color var(--transition-fast),background var(--transition-fast);height:100%}
      .editor-mobile-bar button:hover{background:var(--surface-sun);transform:none;box-shadow:none}
      .editor-mobile-bar button.active{color:var(--accent);background:var(--blue-bg);border-bottom:2px solid var(--accent)}
      .editor-mobile-panel{display:block;border-bottom:1px solid var(--line);background:var(--surface);max-height:50vh;overflow-y:auto}
      .editor-mobile-panel .panel{border-right:none;padding:16px;height:auto;overflow-x:auto}
      .preview-wrap{width:100%;padding:12px;min-height:40vh;overflow-x:hidden}
      .workspace{overflow-x:hidden}
      .workspace > .topbar{display:none !important}
      .top-actions{flex-wrap:wrap;gap:6px}
      .form-grid{grid-template-columns:1fr}
      .document{padding:16px;font-size:.82rem;overflow-x:auto}
      .doc-main-title{font-size:1.4rem}
      .doc-option-title{font-size:1rem}
      .doc-footer{flex-direction:column;gap:8px}
      .option-editor .mini-row{grid-template-columns:1fr}
      .collection-view{padding:16px}
      .settings-page{padding:16px}
      .admin-dashboard{padding:16px}
      .pdf-preview-split{grid-template-columns:1fr}
      .theme-selector{grid-template-columns:1fr}
    }
    @media(max-width:767px){.collection-grid{grid-template-columns:1fr}}
    @media(max-width:680px){
      .swatches{grid-template-columns:repeat(5,1fr)}
      .doc-cost-table,.doc-summary-table{font-size:.78rem}
      .doc-comparison-table{font-size:.75rem}
    }
    .option-editor{position:relative}
    .option-drag-handle{position:absolute;left:-4px;top:50%;transform:translateY(-50%);cursor:grab;padding:8px 4px;color:var(--muted);border-radius:6px;transition:color var(--transition-fast);display:flex;align-items:center;opacity:.4}
    .option-drag-handle:hover{opacity:1;color:var(--accent)}
    .option-drag-handle:active{cursor:grabbing}
    .share-link-row{display:flex;gap:8px;align-items:center}
    .template-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:.68rem;font-weight:var(--weight-bold);background:#6D3FD1;color:#fff;text-transform:uppercase;letter-spacing:.05em;margin-left:8px}
    .theme-toggle{background:transparent;border:1px solid var(--line);border-radius:10px;padding:8px 12px;cursor:pointer;font-size:1.1rem;line-height:1;display:flex;align-items:center;gap:4px;transition:all var(--transition-fast)}
    .theme-toggle:hover{border-color:var(--accent);transform:none;box-shadow:none}

    /* ─── SAVE DIALOG ───────────────────────────────── */
    .save-dialog-overlay{position:fixed;inset:0;background:var(--overlay);display:grid;place-items:center;z-index:1000;padding:20px;animation:fadeIn .15s}
    .save-dialog{background:var(--surface);border-radius:var(--radius-lg);padding:28px;width:100%;max-width:400px;box-shadow:var(--shadow-lg)}
    .save-dialog h3{margin:0 0 6px;font-size:1.1rem;font-weight:var(--weight-extrabold);color:var(--ink)}
    .save-dialog p{margin:0 0 18px;font-size:.85rem;color:var(--muted)}
    .save-dialog input{width:100%;padding:12px 14px;border:2px solid var(--line);border-radius:10px;font-size:.9rem;outline:none;transition:border-color .2s;box-sizing:border-box}
    .save-dialog input:focus{border-color:var(--accent)}
    .save-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    .save-dialog-actions button{padding:10px 20px;border-radius:10px;font-weight:var(--weight-bold);font-size:.85rem;cursor:pointer;transition:all var(--transition-fast)}
    .btn-ghost{background:var(--surface-hov);border:none;color:var(--muted)}
    .btn-ghost:hover{background:var(--line-lt)}
    .btn-primary{background:var(--accent);border:none;color:#fff}
    .btn-primary:hover{box-shadow:0 4px 12px rgba(11,87,208,.3)}
    .btn-primary:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}

    /* ─── CONFIRM MODAL ─────────────────────────────── */
    .confirm-overlay{position:fixed;inset:0;background:var(--overlay);display:grid;place-items:center;z-index:1100;padding:20px;animation:fadeIn .15s}
    .confirm-dialog{background:var(--surface);border-radius:var(--radius-lg);padding:28px;width:100%;max-width:400px;box-shadow:var(--shadow-lg)}
    .confirm-dialog h3{margin:0 0 6px;font-size:1.1rem;font-weight:var(--weight-extrabold);color:var(--ink)}
    .confirm-dialog p{margin:0 0 22px;font-size:.85rem;color:var(--muted);line-height:1.5}
    .confirm-dialog .confirm-actions{display:flex;justify-content:flex-end;gap:8px}

    /* ─── TOAST ─────────────────────────────────────── */
    .toast-container{position:fixed;top:20px;right:20px;z-index:2000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
    .toast{padding:12px 20px;border-radius:10px;font-size:.85rem;font-weight:var(--weight-semibold);pointer-events:auto;animation:toastIn .25s ease-out;display:flex;align-items:center;gap:8px;box-shadow:var(--shadow-md);color:#fff}
    .toast.success{background:#059669}
    .toast.error{background:#dc2626}
    .toast.info{background:var(--accent)}

    /* ─── ONBOARDING ────────────────────────────────── */
    .onb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:grid;place-items:center;z-index:2000;padding:20px;animation:fadeIn .2s}
    .onb-dialog{background:var(--surface);border-radius:20px;padding:36px 32px;width:100%;max-width:440px;box-shadow:var(--shadow-lg);animation:slideUp .25s ease-out}

    /* ─── LOADING / SKELETON ────────────────────────── */
    .view-loading{display:grid;place-items:center;min-height:60vh}
    .spinner{width:32px;height:32px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite}
    .skeleton-card{pointer-events:none}
    .skeleton-line{border-radius:6px;background:linear-gradient(90deg,var(--line-lt) 25%,var(--surface-sun) 50%,var(--line-lt) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
    .skeleton-row{display:flex;gap:8px}
  `}</style>;
}
