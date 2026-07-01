import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts';
import dataService from '../utils/dataService';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

interface AdminUser {
  email?: string;
  username?: string;
  role?: string;
  regDate?: string;
  createdAt?: string;
  tokensUsed?: number;
  tokenLimit?: number;
  [key: string]: unknown;
}

interface AdminQuote {
  id?: string;
  title?: string;
  client?: string | { name?: string; contactPerson?: string; email?: string };
  owner?: string;
  userEmail?: string;
  status?: string;
  date?: string;
  options?: unknown[];
  [key: string]: unknown;
}

function safeStr(v: unknown, fallback: string = '—'): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v || fallback;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.contactPerson === 'string') return obj.contactPerson;
  }
  return fallback;
}

function formatDate(v: unknown): string {
  if (!v) return '—';
  if (typeof v !== 'string') return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return v;
}

function getQuoteTitle(q: AdminQuote): string {
  return safeStr(q.title, 'Senza titolo');
}

function getQuoteClient(q: AdminQuote): string {
  if (!q.client) return '—';
  if (typeof q.client === 'string') return q.client || '—';
  if (typeof q.client === 'object') {
    return safeStr(q.client.name || q.client.contactPerson);
  }
  return '—';
}

function getQuoteOwner(q: AdminQuote): string {
  return safeStr(q.owner ?? q.userEmail);
}

function getQuoteStatus(q: AdminQuote): string {
  return safeStr(q.status, 'BOZZA');
}

function getQuoteDate(q: AdminQuote): string {
  return formatDate(q.date);
}

function getQuoteOptionsCount(q: AdminQuote): number {
  return Array.isArray(q.options) ? q.options.length : 0;
}

function getUserRegDate(u: AdminUser): string {
  return formatDate(u.regDate ?? u.createdAt);
}

type AdminTab = 'overview' | 'codes';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState('');
  const [dsStatus, setDsStatus] = useState<{ configured?: boolean } | null>(null);
  const [pwChange, setPwChange] = useState<string | null>(null);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  // Phase 5 — unlock codes state
  const [unlockCodes, setUnlockCodes] = useState<any[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('starter');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [unlockedUsers, setUnlockedUsers] = useState<Set<string>>(new Set());

  const refreshCodes = async () => {
    setCodesLoading(true);
    setCodesError(null);
    try {
      const res: any = await dataService.adminListUnlockCodes();
      setUnlockCodes(res?.codes || []);
    } catch (err: any) {
      setCodesError(err?.message || 'Errore caricamento codici');
    } finally {
      setCodesLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'codes') refreshCodes();
  }, [tab]);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodesError(null);
    setGeneratedCode(null);
    const res: any = await dataService.adminGenerateUnlockCode(selectedPackage);
    if (res?.error) {
      setCodesError(res.error);
      return;
    }
    if (res?.code) {
      setGeneratedCode(res.code);
      await refreshCodes();
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
    }
  };

  const handleUnlockUser = async (email: string) => {
    const res: any = await dataService.adminUnlockUser(email);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setUnlockedUsers(prev => new Set(prev).add(email));
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      dataService.adminGetUsers().catch(() => ({ users: [] })),
      dataService.adminGetAllQuotes().catch(() => ({ quotes: [] })),
    ]).then(([usersRes, quotesRes]: any) => {
      if (!mounted) return;
      setUsers((usersRes.users as AdminUser[]) || []);
      setQuotes((quotesRes.quotes as AdminQuote[]) || []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const checkDeepSeekStatus = async () => {
    const result = await dataService.checkDeepSeekStatus();
    setDsStatus(result);
  };

  const totalTokens = users.reduce((s, u) => s + (u.tokensUsed || 0), 0);
  const totalTokenLimit = users.reduce((s, u) => s + (u.tokenLimit || 0), 0);
  const totalOptions = quotes.reduce((s, q) => s + getQuoteOptionsCount(q), 0);

  const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  const handleChangePassword = async (email: string) => {
    if (!pwOld || !pwNew) {
      setPwMsg({ text: 'Compila tutti i campi', tone: 'err' });
      return;
    }
    if (!pwRegex.test(pwNew)) {
      setPwMsg({ text: 'Password non valida (12+ car, Aa1!)', tone: 'err' });
      return;
    }
    const result = await dataService.changePassword(email, pwOld, pwNew);
    if (result.success) {
      setPwMsg({ text: 'Password cambiata con successo', tone: 'ok' });
      setPwChange(null);
      setPwOld('');
      setPwNew('');
    } else {
      setPwMsg({ text: result.error || 'Errore', tone: 'err' });
    }
    setTimeout(() => setPwMsg(null), 3000);
  };

  const handleSetLimit = async (email: string) => {
    const val = parseInt(limitValue, 10);
    if (isNaN(val) || val < 0) return;
    await dataService.adminUpdateLimits(email, val);
    setEditingLimit(null);
    setLimitValue('');
    const { users: list } = await dataService.adminGetUsers('admin_users_fresh');
    setUsers((list as AdminUser[]) || []);
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-dashboard">
        <div className="admin-access-denied">
          <h2>🔒 Accesso negato</h2>
          <p>Solo gli amministratori possono accedere a questa pagina.</p>
        </div>
        <style>{adminStyles}</style>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-head">
        <h2>Dashboard Amministratore</h2>
        <span>Benvenuto, {safeStr(user.username, 'admin')}</span>
      </div>

      <div className="admin-stats">
        <div className="admin-stat"><b>{users.length}</b><span>Utenti attivi</span></div>
        <div className="admin-stat"><b>{quotes.length}</b><span>Preventivi totali</span></div>
        <div className="admin-stat"><b>{totalOptions}</b><span>Opzioni totali</span></div>
        <div className="admin-stat"><b>{totalTokens.toLocaleString('it-IT')}</b><span>Token AI usati</span></div>
        <div className="admin-stat"><b>{totalTokenLimit.toLocaleString('it-IT') || '∞'}</b><span>Limite token totale</span></div>
      </div>

      <div className="admin-tabs" role="tablist" data-testid="admin-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`admin-tab ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
          data-testid="admin-tab-overview"
        >
          Panoramica
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'codes'}
          className={`admin-tab ${tab === 'codes' ? 'active' : ''}`}
          onClick={() => setTab('codes')}
          data-testid="admin-tab-codes"
        >
          Codici sblocco
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {tab === 'overview' ? (
      <>
      <div className="admin-section">
        <h3>DeepSeek API</h3>
        <div className="admin-apikey-info">
          {IS_LOCAL ? (
            <>
              <p>Chiave letta da <code>.env</code> (variabile <code>VITE_DEEPSEEK_API_KEY</code>).</p>
              <p>Per cambiarla, modifica il file <code>.env</code> nella root del progetto.</p>
            </>
          ) : (
            <>
              <p>Chiave gestita tramite la variabile d'ambiente <code>DEEPSEEK_API_KEY</code> su Vercel.</p>
              <p>Vai su <strong>Vercel Dashboard → Settings → Environment Variables</strong> e aggiungila con scope <strong>Production, Preview</strong>.</p>
            </>
          )}
          <div className="admin-apikey-check">
            <button onClick={checkDeepSeekStatus} className="btn-check-status">Verifica stato</button>
            {dsStatus && (
              <span className={`ds-status ${dsStatus.configured ? 'ok' : 'no'}`}>
                {dsStatus.configured ? 'Configurata' : 'Non configurata'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h3>Utenti ({users.length})</h3>
        {loading ? (
          <div className="admin-empty">Caricamento…</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">Nessun utente registrato.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Ruolo</th>
                  <th>Registrato</th>
                  <th>Token usati</th>
                  <th>Limite token</th>
                  <th>Password</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => {
                  const email = safeStr(u.email, `user-${idx}`);
                  return (
                    <tr key={email + idx}>
                      <td>{email}</td>
                      <td>{safeStr(u.username)}</td>
                      <td>
                        <span className={`admin-role ${u.role === 'admin' ? 'admin' : 'user'}`}>
                          {safeStr(u.role, 'user')}
                        </span>
                      </td>
                      <td>{getUserRegDate(u)}</td>
                      <td>{(u.tokensUsed || 0).toLocaleString('it-IT')}</td>
                      <td>
                        {editingLimit === email ? (
                          <div className="admin-limit-edit">
                            <input
                              type="number"
                              value={limitValue}
                              onChange={(e) => setLimitValue(e.target.value)}
                              min="0"
                            />
                            <button onClick={() => handleSetLimit(email)}>Salva</button>
                            <button
                              className="btn-ghost"
                              onClick={() => setEditingLimit(null)}
                            >
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <span>{(u.tokenLimit ?? 0).toLocaleString('it-IT') || '∞'}</span>
                        )}
                      </td>
                      <td>
                        {pwChange === email ? (
                          <div className="admin-pw-edit">
                            <input
                              type="password"
                              placeholder="Vecchia"
                              value={pwOld}
                              onChange={(e) => setPwOld(e.target.value)}
                            />
                            <input
                              type="password"
                              placeholder="Nuova (12+ car, Aa1!)"
                              value={pwNew}
                              onChange={(e) => setPwNew(e.target.value)}
                            />
                            <button onClick={() => handleChangePassword(email)}>Salva</button>
                            <button
                              className="btn-ghost"
                              onClick={() => {
                                setPwChange(null);
                                setPwOld('');
                                setPwNew('');
                                setPwMsg(null);
                              }}
                            >
              X
                            </button>
                            {pwMsg && (
                              <span className={`pw-msg ${pwMsg.tone === 'ok' ? 'ok' : 'err'}`}>
                                {pwMsg.text}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            className="btn-pw"
                            onClick={() => {
                              setPwChange(email);
                              setPwOld('');
                              setPwNew('');
                              setPwMsg(null);
                            }}
                          >
                            Cambia password
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setEditingLimit(email);
                            setLimitValue(String(u.tokenLimit || 0));
                          }}
                        >
                          Modifica limite
                        </button>
                        {unlockedUsers.has(email) ? (
                          <span className="admin-unlocked-badge" style={{ marginLeft: 8, color: '#059669', fontWeight: 700, fontSize: '.72rem' }}>✓ Sbloccato</span>
                        ) : (
                          <button
                            onClick={() => handleUnlockUser(email)}
                            style={{ marginLeft: 6, borderColor: '#059669', color: '#059669' }}
                            title="Sblocca utente: tier unlocked, no watermark, documenti illimitati"
                          >
                            Sblocca
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h3>Preventivi ({quotes.length})</h3>
        {loading ? (
          <div className="admin-empty">Caricamento…</div>
        ) : quotes.length === 0 ? (
          <div className="admin-empty">Nessun preventivo salvato.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Titolo</th>
                  <th>Cliente</th>
                  <th>Proprietario</th>
                  <th>Stato</th>
                  <th>Data</th>
                  <th>Opzioni</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q, idx) => {
                  const id = safeStr(q.id, `q-${idx}`);
                  return (
                    <tr key={id + idx}>
                      <td>{id}</td>
                      <td>{getQuoteTitle(q)}</td>
                      <td>{getQuoteClient(q)}</td>
                      <td>{getQuoteOwner(q)}</td>
                      <td>
                        <span className={`admin-status ${getQuoteStatus(q).toLowerCase()}`}>
                          {getQuoteStatus(q)}
                        </span>
                      </td>
                      <td>{getQuoteDate(q)}</td>
                      <td>{getQuoteOptionsCount(q)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : null}

      {tab === 'codes' ? (
        <div className="admin-section" data-testid="admin-codes-panel">
          <h3>Codici sblocco ({unlockCodes.length})</h3>
          <p className="admin-section-desc">
            Genera un codice da assegnare a un cliente dopo il pagamento.
            Il cliente potrà riscattarlo dalla pagina Impostazioni del suo
            account per sbloccare il tier (documenti illimitati, no
            watermark).
          </p>

          <form onSubmit={handleGenerateCode} className="admin-code-form" data-testid="admin-code-form">
            <label htmlFor="admin-code-package" className="admin-code-label">
              Pacchetto
            </label>
            <select
              id="admin-code-package"
              className="admin-code-select"
              value={selectedPackage}
              onChange={(e) => setSelectedPackage(e.target.value)}
              data-testid="admin-code-package"
            >
              <option value="starter">Starter (€149)</option>
              <option value="apertura">Apertura (€349)</option>
              <option value="presenza">Presenza (€690)</option>
              <option value="custom">Custom (manuale)</option>
            </select>
            <button type="submit" className="btn-primary" data-testid="admin-code-generate">
              Genera codice
            </button>
          </form>

          {generatedCode && (
            <div className="admin-code-result" data-testid="admin-code-result">
              <span>Nuovo codice generato:</span>
              <code>{generatedCode}</code>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => copyToClipboard(generatedCode)}
                data-testid="admin-code-copy"
              >
                Copia
              </button>
            </div>
          )}

          {codesError && <div className="admin-error" data-testid="admin-codes-error">{codesError}</div>}

          {codesLoading ? (
            <div className="admin-empty">Caricamento…</div>
          ) : unlockCodes.length === 0 ? (
            <div className="admin-empty">Nessun codice generato. Clicca "Genera codice" per crearne uno.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Pacchetto</th>
                    <th>Usato da</th>
                    <th>Usato il</th>
                    <th>Generato il</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {unlockCodes.map((c: any) => {
                    const code = c.code || '';
                    return (
                      <tr key={code} data-testid="admin-code-row">
                        <td><code>{code}</code></td>
                        <td>{c.package || '—'}</td>
                        <td>{c.usedBy || '—'}</td>
                        <td>{formatDate(c.usedAt)}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => copyToClipboard(code)}
                          >
                            Copia
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <style>{adminStyles}</style>
    </div>
  );
}

const adminStyles = `
.admin-dashboard{padding:28px;font-family:ui-sans-serif,system-ui,sans-serif;color:#07111f}
[data-theme="dark"] .admin-dashboard{color:#e8eaf0}
.admin-access-denied{padding:48px 28px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;max-width:480px;margin:48px auto}
[data-theme="dark"] .admin-access-denied{background:#1a1d27;border-color:#2d3044}
.admin-access-denied h2{margin:0 0 12px}
.admin-access-denied p{color:#647086;margin:0}
[data-theme="dark"] .admin-access-denied p{color:#8892a8}
.admin-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.admin-head h2{margin:0;font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
.admin-head span{font-size:.85rem;color:#647086}
[data-theme="dark"] .admin-head span{color:#8892a8}
.admin-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px}
.admin-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center}
[data-theme="dark"] .admin-stat{background:#1a1d27;border-color:#2d3044}
.admin-stat b{display:block;font-size:1.6rem;font-weight:900;color:#1A1A1A;line-height:1.2;margin-bottom:4px;overflow-wrap:break-word;word-break:break-word}
[data-theme="dark"] .admin-stat b{color:#e8eaf0}
.admin-stat span{font-size:.75rem;color:#647086;text-transform:uppercase;letter-spacing:.05em;font-weight:600;line-height:1.3}
[data-theme="dark"] .admin-stat span{color:#8892a8}
.admin-error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:.85rem}
[data-theme="dark"] .admin-error{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.2);color:#f87171}
.admin-empty{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px;text-align:center;color:#647086;font-size:.9rem}
[data-theme="dark"] .admin-empty{background:#1a1d27;border-color:#2d3044;color:#8892a8}
.admin-section{margin-bottom:28px}
.admin-section h3{font-size:1rem;font-weight:800;margin:0 0 12px}
.admin-table-wrap{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
[data-theme="dark"] .admin-table-wrap{background:#1a1d27;border-color:#2d3044}
.admin-table{width:100%;border-collapse:collapse;font-size:.82rem}
.admin-table th,.admin-table td{padding:10px 14px;text-align:left;border-bottom:1px solid #f1f5f9;vertical-align:middle;max-width:240px;overflow:hidden;text-overflow:ellipsis}
[data-theme="dark"] .admin-table th,[data-theme="dark"] .admin-table td{border-bottom-color:#2d3044}
.admin-table th{background:#f8fafc;font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#647086}
[data-theme="dark"] .admin-table th{background:#14161f;color:#8892a8}
.admin-table tr:last-child td{border-bottom:none}
.admin-table tr:hover{background:rgba(230,32,32,.02)}
[data-theme="dark"] .admin-table tr:hover{background:rgba(255,255,255,.02)}
.admin-role{padding:3px 8px;border-radius:6px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;display:inline-block}
.admin-role.admin{background:#FCE8E8;color:#E62020}
[data-theme="dark"] .admin-role.admin{background:rgba(255,59,59,.12);color:#FF3B3B}
.admin-role.user{background:#f0f1f5;color:#666c7c}
[data-theme="dark"] .admin-role.user{background:rgba(255,255,255,.06);color:#8892a8}
.admin-status{padding:3px 8px;border-radius:6px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;display:inline-block}
.admin-status.bozza,.admin-status.draft{background:#f0f1f5;color:#666c7c}
[data-theme="dark"] .admin-status.bozza,[data-theme="dark"] .admin-status.draft{background:rgba(255,255,255,.06);color:#8892a8}
.admin-status.inviato,.admin-status.sent{background:#FFF1F1;color:#E62020}
[data-theme="dark"] .admin-status.inviato,[data-theme="dark"] .admin-status.sent{background:rgba(255,59,59,.12);color:#FF3B3B}
.admin-status.accettato,.admin-status.accepted{background:#f7eddc;color:#a66200}
[data-theme="dark"] .admin-status.accettato,[data-theme="dark"] .admin-status.accepted{background:rgba(245,158,11,.12);color:#f59e0b}
.admin-status.rifiutato,.admin-status.rejected{background:#fef2f2;color:#dc2626}
[data-theme="dark"] .admin-status.rifiutato,[data-theme="dark"] .admin-status.rejected{background:rgba(248,113,113,.12);color:#f87171}
.admin-status.archived{background:#f3f4f6;color:#9ca3af}
[data-theme="dark"] .admin-status.archived{background:rgba(255,255,255,.04);color:#9ca3af}
.admin-limit-edit{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.admin-limit-edit input{width:90px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:.8rem}
[data-theme="dark"] .admin-limit-edit input{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
.admin-limit-edit button{padding:4px 8px;border:none;border-radius:6px;font-size:.72rem;font-weight:600;cursor:pointer;background:#E62020;color:#fff}
.admin-limit-edit .btn-ghost{background:transparent;color:#647086}
[data-theme="dark"] .admin-limit-edit .btn-ghost{color:#8892a8}
.admin-table td button{padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;font-size:.72rem;font-weight:600;cursor:pointer;transition:all .15s}
[data-theme="dark"] .admin-table td button{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
.admin-table td button:hover{border-color:#E62020;color:#E62020}
.admin-apikey-info{background:#f0f7ff;border:1px solid #b8d6ff;border-radius:12px;padding:16px 20px;font-size:.85rem;color:#1e4a7a;line-height:1.6;overflow-wrap:break-word;word-break:break-word}
[data-theme="dark"] .admin-apikey-info{background:rgba(255,59,59,.08);border-color:rgba(255,59,59,.15);color:#8ab4f8}
.admin-apikey-info code{background:rgba(230,32,32,.08);padding:2px 6px;border-radius:4px;font-size:.82rem;overflow-wrap:break-word;word-break:break-all}
[data-theme="dark"] .admin-apikey-info code{background:rgba(255,59,59,.15)}
.admin-apikey-check{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}
.btn-check-status{padding:8px 16px;border:1px solid #E62020;background:#fff;color:#E62020;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
[data-theme="dark"] .btn-check-status{background:#1a1d27;border-color:#FF3B3B;color:#FF3B3B}
.btn-check-status:hover{background:#FCE8E8}
[data-theme="dark"] .btn-check-status:hover{background:rgba(255,59,59,.12)}
.ds-status{font-size:.82rem;font-weight:600;padding:6px 0}
.ds-status.ok{color:#11845b}
[data-theme="dark"] .ds-status.ok{color:#22c55e}

/* Phase 5 — Tabs (Panoramica / Codici sblocco) */
.admin-tabs{display:flex;gap:6px;margin:0 0 24px;border-bottom:1px solid #e2e8f0;padding:0 0 1px}
[data-theme="dark"] .admin-tabs{border-bottom-color:#2d3044}
.admin-tab{background:transparent;border:none;padding:10px 18px;font-size:.85rem;font-weight:600;color:#647086;cursor:pointer;border-radius:8px 8px 0 0;transition:all .15s;border-bottom:2px solid transparent;margin-bottom:-1px}
[data-theme="dark"] .admin-tab{color:#8892a8}
.admin-tab:hover{color:#E62020;background:rgba(230,32,32,.04)}
[data-theme="dark"] .admin-tab:hover{color:#FF3B3B;background:rgba(255,59,59,.08)}
.admin-tab.active{color:#E62020;border-bottom-color:#E62020}
[data-theme="dark"] .admin-tab.active{color:#FF3B3B;border-bottom-color:#FF3B3B}
.admin-section-desc{font-size:.85rem;color:#647086;margin:0 0 18px;line-height:1.5}
[data-theme="dark"] .admin-section-desc{color:#8892a8}

/* Phase 5 — Code generation form */
.admin-code-form{display:flex;align-items:flex-end;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.admin-code-label{font-size:.78rem;font-weight:600;color:#07111f;display:block;margin-bottom:4px}
[data-theme="dark"] .admin-code-label{color:#e8eaf0}
.admin-code-select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:.85rem;background:#fff;color:#07111f;font-family:inherit;min-width:200px}
[data-theme="dark"] .admin-code-select{background:#1a1d27;border-color:#2d3044;color:#e8eaf0}
.admin-code-result{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:18px;font-size:.88rem;flex-wrap:wrap}
[data-theme="dark"] .admin-code-result{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.2)}
.admin-code-result code{font-family:'Roboto Mono','Courier New',monospace;font-size:.92rem;font-weight:700;color:#11845b;background:#fff;padding:4px 10px;border-radius:6px;border:1px solid #d1fae5;flex:1;min-width:280px;overflow-wrap:anywhere}
[data-theme="dark"] .admin-code-result code{background:#14161f;border-color:rgba(34,197,94,.3);color:#22c55e}
.ds-status.no{color:#dc2626}
[data-theme="dark"] .ds-status.no{color:#f87171}
.btn-pw{padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;font-size:.72rem;font-weight:600;cursor:pointer;white-space:nowrap}
[data-theme="dark"] .btn-pw{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
.btn-pw:hover{border-color:#E62020;color:#E62020}
.admin-pw-edit{display:flex;flex-direction:column;gap:4px;min-width:200px}
.admin-pw-edit input{padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:.75rem;width:100%}
[data-theme="dark"] .admin-pw-edit input{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
.admin-pw-edit button{padding:3px 8px;border:none;border-radius:6px;font-size:.7rem;font-weight:600;cursor:pointer;background:#E62020;color:#fff;align-self:flex-start}
.admin-pw-edit .btn-ghost{background:transparent;color:#647086;padding:3px 6px;align-self:flex-start}
[data-theme="dark"] .admin-pw-edit .btn-ghost{color:#8892a8}
.pw-msg{font-size:.7rem;font-weight:600;margin-top:2px;line-height:1.3}
.pw-msg.ok{color:#11845b}
[data-theme="dark"] .pw-msg.ok{color:#22c55e}
.pw-msg.err{color:#dc2626}
[data-theme="dark"] .pw-msg.err{color:#f87171}
@media(max-width:768px){
  .admin-dashboard{padding:16px}
  .admin-head{flex-direction:column;align-items:flex-start;gap:8px}
  .admin-stats{grid-template-columns:1fr 1fr !important;gap:10px}
  .admin-stat{padding:16px 12px;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .admin-stat b{font-size:1.4rem;line-height:1.2;margin-bottom:4px}
  .admin-stat span{font-size:.7rem;line-height:1.3}
  .admin-table{font-size:.72rem;table-layout:fixed;white-space:normal}
  .admin-table th,.admin-table td{padding:6px 8px;word-break:break-word;overflow:hidden;max-width:140px}
  .admin-table th:nth-child(7),.admin-table th:nth-child(8),.admin-table td:nth-child(7),.admin-table td:nth-child(8){display:none}
  .admin-table-wrap{overflow-x:hidden}
  .admin-pw-edit{min-width:160px}
  .admin-pw-edit input{font-size:.7rem}
  .admin-limit-edit input{width:60px}
  .admin-section h3{font-size:.9rem}
  .admin-apikey-info{padding:12px 14px;font-size:.8rem;overflow-wrap:break-word;word-break:break-word}
  .btn-check-status{padding:6px 12px;font-size:.78rem}
}
@media(max-width:480px){
  .admin-stats{grid-template-columns:1fr 1fr !important;gap:8px}
  .admin-stat{padding:14px 10px;min-height:72px}
  .admin-stat b{font-size:1.2rem}
  .admin-stat span{font-size:.65rem}
  .admin-table{font-size:.65rem;table-layout:fixed;white-space:normal}
  .admin-table th,.admin-table td{padding:4px 4px;word-break:break-word;overflow:hidden;max-width:120px}
  .admin-table th:nth-child(7),.admin-table th:nth-child(8),.admin-table td:nth-child(7),.admin-table td:nth-child(8){display:none}
  .admin-pw-edit{min-width:0;width:100%}
  .admin-pw-edit input{font-size:.65rem}
  .admin-limit-edit{flex-wrap:wrap}
  .admin-head h2{font-size:1.1rem}
}
`;
