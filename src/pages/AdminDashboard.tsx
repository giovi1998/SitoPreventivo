import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../App';
import dataService from '../utils/dataService';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState('');
  const [dsStatus, setDsStatus] = useState<any>(null);
  const [pwChange, setPwChange] = useState<string | null>(null);
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => {
    dataService.adminGetUsers().then(({ users: list }: any) => setUsers(list || []));
    dataService.adminGetAllQuotes().then(({ quotes: list }: any) => setQuotes(list || []));
  }, []);

  const checkDeepSeekStatus = async () => {
    const result = await dataService.checkDeepSeekStatus();
    setDsStatus(result);
  };

  const totalTokens = users.reduce((s, u) => s + (u.tokensUsed || 0), 0);
  const totalTokenLimit = users.reduce((s, u) => s + (u.tokenLimit || 0), 0);

  const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  const handleChangePassword = async (email: string) => {
    if (!pwOld || !pwNew) { setPwMsg('Compila tutti i campi'); return; }
    if (!pwRegex.test(pwNew)) { setPwMsg('Minimo 12 caratteri, maiuscola, minuscola, numero e speciale'); return; }
    const result = await dataService.changePassword(email, pwOld, pwNew);
    if (result.success) {
      setPwMsg('Password cambiata con successo');
      setPwChange(null);
      setPwOld('');
      setPwNew('');
    } else {
      setPwMsg(result.error || 'Errore');
    }
    setTimeout(() => setPwMsg(''), 3000);
  };

  const handleSetLimit = async (email: string) => {
    const val = parseInt(limitValue, 10);
    if (isNaN(val) || val < 0) return;
    await dataService.adminUpdateLimits(email, val);
    setEditingLimit(null);
    setLimitValue('');
    const { users: list } = await dataService.adminGetUsers('admin_users_fresh');
    setUsers(list || []);
  };

  if (!user || user.role !== 'admin') {
    return <div className="admin-dashboard"><h2>Accesso negato</h2><p>Solo gli amministratori possono accedere a questa pagina.</p></div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-head"><h2>Dashboard Amministratore</h2><span>Benvenuto, {user.username}</span></div>

      <div className="admin-stats">
        <div className="admin-stat"><b>{users.length}</b><span>Utenti attivi</span></div>
        <div className="admin-stat"><b>{quotes.length}</b><span>Preventivi totali</span></div>
        <div className="admin-stat"><b>{totalTokens.toLocaleString()}</b><span>Token AI usati</span></div>
        <div className="admin-stat"><b>{totalTokenLimit.toLocaleString()}</b><span>Limite token totale</span></div>
      </div>

      <div className="admin-section">
        <h3>DeepSeek API</h3>
        {IS_LOCAL ? (
          <div className="admin-apikey-info">
            <p>Chiave letta da <code>.env</code> (variabile <code>VITE_DEEPSEEK_API_KEY</code>).</p>
            <p>Per cambiarla, modifica il file <code>.env</code> nella root del progetto.</p>
            <div className="admin-apikey-check">
              <button onClick={checkDeepSeekStatus} className="btn-check-status">Verifica stato</button>
              {dsStatus && (
                <span className={`ds-status ${dsStatus.configured ? 'ok' : 'no'}`}>
                  {dsStatus.configured ? 'Configurata' : 'Non configurata'}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="admin-apikey-info">
            <p>Chiave gestita tramite la variabile d'ambiente <code>DEEPSEEK_API_KEY</code> su Vercel.</p>
            <p>Vai su <strong>Vercel Dashboard → Settings → Environment Variables</strong> e aggiungila con scope <strong>Production, Preview</strong>.</p>
            <div className="admin-apikey-check">
              <button onClick={checkDeepSeekStatus} className="btn-check-status">Verifica stato chiave</button>
              {dsStatus && (
                <span className={`ds-status ${dsStatus.configured ? 'ok' : 'no'}`}>
                  {dsStatus.configured ? 'Configurata su Vercel' : 'Non configurata'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h3>Utenti</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Username</th><th>Ruolo</th><th>Registrato</th><th>Token usati</th><th>Limite token</th><th>Password</th><th>Azioni</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.username}</td>
                  <td><span className={`admin-role ${u.role === 'admin' ? 'admin' : 'user'}`}>{u.role || 'user'}</span></td>
                  <td>{u.regDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('it-IT') : '-')}</td>
                  <td>{(u.tokensUsed || 0).toLocaleString()}</td>
                  <td>
                    {editingLimit === u.email ? (
                      <div className="admin-limit-edit">
                        <input type="number" value={limitValue} onChange={e => setLimitValue(e.target.value)} min="0" />
                        <button onClick={() => handleSetLimit(u.email)}>Salva</button>
                        <button className="btn-ghost" onClick={() => setEditingLimit(null)}>Annulla</button>
                      </div>
                    ) : (
                      <span>{u.tokenLimit?.toLocaleString() || '∞'}</span>
                    )}
                  </td>
                  <td>
                    {pwChange === u.email ? (
                      <div className="admin-pw-edit">
                        <input type="password" placeholder="Vecchia" value={pwOld} onChange={e => setPwOld(e.target.value)} />
                        <input type="password" placeholder="Nuova (12+ car, Aa1!)" value={pwNew} onChange={e => setPwNew(e.target.value)} />
                        <button onClick={() => handleChangePassword(u.email)}>Salva</button>
                        <button className="btn-ghost" onClick={() => { setPwChange(null); setPwOld(''); setPwNew(''); setPwMsg(''); }}>X</button>
                        {pwMsg && <span className="pw-msg">{pwMsg}</span>}
                      </div>
                    ) : (
                      <button className="btn-pw" onClick={() => { setPwChange(u.email); setPwOld(''); setPwNew(''); setPwMsg(''); }}>
                        Cambia password
                      </button>
                    )}
                  </td>
                  <td>
                    <button onClick={() => { setEditingLimit(u.email); setLimitValue(String(u.tokenLimit || 0)); }}>
                      Modifica limite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <h3>Preventivi ({quotes.length})</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Titolo</th><th>Cliente</th><th>Proprietario</th><th>Stato</th><th>Data</th><th>Opzioni</th></tr></thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id}>
                  <td>{q.id}</td>
                  <td>{q.title}</td>
                  <td>{q.client}</td>
                  <td>{q.owner || q.userEmail}</td>
                  <td><span className={`admin-status ${(q.status || 'BOZZA').toLowerCase()}`}>{q.status || 'BOZZA'}</span></td>
                  <td>{q.date}</td>
                  <td>{q.options?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .admin-dashboard{padding:28px;font-family:ui-sans-serif,system-ui,sans-serif;color:#07111f}
        [data-theme="dark"] .admin-dashboard{color:#e8eaf0}
        .admin-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .admin-head h2{margin:0;font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
        .admin-head span{font-size:.85rem;color:#647086}
        [data-theme="dark"] .admin-head span{color:#8892a8}
        .admin-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px}
        .admin-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center}
        [data-theme="dark"] .admin-stat{background:#1a1d27;border-color:#2d3044}
        .admin-stat b{display:block;font-size:1.6rem;font-weight:900;color:#0B57D0}
        [data-theme="dark"] .admin-stat b{color:#4d94ff}
        .admin-stat span{font-size:.8rem;color:#647086;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
        [data-theme="dark"] .admin-stat span{color:#8892a8}
        .admin-section{margin-bottom:28px}
        .admin-section h3{font-size:1rem;font-weight:800;margin:0 0 12px}
        .admin-table-wrap{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
        [data-theme="dark"] .admin-table-wrap{background:#1a1d27;border-color:#2d3044}
        .admin-table{width:100%;border-collapse:collapse;font-size:.82rem;white-space:nowrap}
        .admin-table th,.admin-table td{padding:10px 14px;text-align:left;border-bottom:1px solid #f1f5f9}
        [data-theme="dark"] .admin-table th,[data-theme="dark"] .admin-table td{border-bottom-color:#2d3044}
        .admin-table th{background:#f8fafc;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#647086}
        [data-theme="dark"] .admin-table th{background:#14161f;color:#8892a8}
        .admin-table tr:last-child td{border-bottom:none}
        .admin-role{padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:700;text-transform:uppercase}
        .admin-role.admin{background:#e8f0fe;color:#0B57D0}
        [data-theme="dark"] .admin-role.admin{background:rgba(77,148,255,.1);color:#4d94ff}
        .admin-role.user{background:#f0f1f5;color:#666c7c}
        [data-theme="dark"] .admin-role.user{background:#22263a;color:#8892a8}
        .admin-status{padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600}
        .admin-status.bozza{background:#f0f1f5;color:#666c7c}
        [data-theme="dark"] .admin-status.bozza{background:#22263a;color:#8892a8}
        .admin-status.inviato{background:#e6eefc;color:#0B57D0}
        [data-theme="dark"] .admin-status.inviato{background:rgba(77,148,255,.1);color:#4d94ff}
        .admin-status.accettato{background:#f7eddc;color:#a66200}
        [data-theme="dark"] .admin-status.accettato{background:rgba(245,158,11,.1);color:#f59e0b}
        .admin-status.rifiutato{background:#fef2f2;color:#dc2626}
        [data-theme="dark"] .admin-status.rifiutato{background:rgba(248,113,113,.1);color:#f87171}
        .admin-limit-edit{display:flex;gap:4px;align-items:center}
        .admin-limit-edit input{width:80px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:.8rem}
        [data-theme="dark"] .admin-limit-edit input{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
        .admin-limit-edit button{padding:4px 8px;border:none;border-radius:6px;font-size:.72rem;font-weight:600;cursor:pointer;background:#0B57D0;color:#fff}
        .admin-limit-edit .btn-ghost{background:transparent;color:#647086}
        [data-theme="dark"] .admin-limit-edit .btn-ghost{color:#8892a8}
        .admin-table td button{padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;font-size:.72rem;font-weight:600;cursor:pointer;transition:border-color .15s}
        [data-theme="dark"] .admin-table td button{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
        .admin-table td button:hover{border-color:#0B57D0;color:#0B57D0}
        .admin-apikey-info{background:#f0f7ff;border:1px solid #b8d6ff;border-radius:12px;padding:16px 20px;font-size:.85rem;color:#1e4a7a;line-height:1.6}
        [data-theme="dark"] .admin-apikey-info{background:rgba(77,148,255,.08);border-color:rgba(77,148,255,.15);color:#8ab4f8}
        .admin-apikey-info code{background:rgba(11,87,208,.08);padding:2px 6px;border-radius:4px;font-size:.82rem}
        [data-theme="dark"] .admin-apikey-info code{background:rgba(77,148,255,.15)}
        .admin-apikey-check{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}
        .btn-check-status{padding:8px 16px;border:1px solid #0B57D0;background:#fff;color:#0B57D0;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
        [data-theme="dark"] .btn-check-status{background:#1a1d27;border-color:#4d94ff;color:#4d94ff}
        .btn-check-status:hover{background:#e8f0fe}
        [data-theme="dark"] .btn-check-status:hover{background:rgba(77,148,255,.1)}
        .ds-status{font-size:.82rem;font-weight:600;padding:6px 0}
        .ds-status.ok{color:#11845b}
        [data-theme="dark"] .ds-status.ok{color:#22c55e}
        .ds-status.no{color:#dc2626}
        [data-theme="dark"] .ds-status.no{color:#f87171}
        .btn-pw{padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;font-size:.72rem;font-weight:600;cursor:pointer;white-space:nowrap}
        [data-theme="dark"] .btn-pw{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
        .btn-pw:hover{border-color:#0B57D0;color:#0B57D0}
        .admin-pw-edit{display:flex;flex-direction:column;gap:4px;min-width:200px}
        .admin-pw-edit input{padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:.75rem;width:100%}
        [data-theme="dark"] .admin-pw-edit input{border-color:#2d3044;background:#1a1d27;color:#e8eaf0}
        .admin-pw-edit button{padding:3px 8px;border:none;border-radius:6px;font-size:.7rem;font-weight:600;cursor:pointer;background:#0B57D0;color:#fff;align-self:flex-start}
        .admin-pw-edit .btn-ghost{background:transparent;color:#647086;padding:3px 6px;align-self:flex-start}
        [data-theme="dark"] .admin-pw-edit .btn-ghost{color:#8892a8}
        .pw-msg{font-size:.7rem;font-weight:600;color:#11845b}
        [data-theme="dark"] .pw-msg{color:#22c55e}
        .ds-keys-note{font-weight:400;color:#647086;font-size:.78rem}
        @media(max-width:768px){
          .admin-dashboard{padding:16px}
          .admin-head{flex-direction:column;align-items:flex-start;gap:8px}
          .admin-stats{grid-template-columns:1fr 1fr;gap:10px}
          .admin-stat{padding:16px 12px;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center}
          .admin-stat b{font-size:1.5rem;line-height:1.2;margin-bottom:4px}
          .admin-stat span{font-size:.7rem;line-height:1.3}
          .admin-table{font-size:.75rem}
          .admin-table th,.admin-table td{padding:8px 10px}
          .admin-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .admin-pw-edit{min-width:160px}
          .admin-pw-edit input{font-size:.7rem}
          .admin-limit-edit input{width:60px}
          .admin-section h3{font-size:.9rem}
          .admin-apikey-info{padding:12px 14px;font-size:.8rem}
          .btn-check-status{padding:6px 12px;font-size:.78rem}
        }
        @media(max-width:480px){
          .admin-stats{grid-template-columns:1fr 1fr;gap:8px}
          .admin-stat{padding:14px 10px;min-height:72px}
          .admin-stat b{font-size:1.3rem}
          .admin-stat span{font-size:.65rem}
          .admin-table{font-size:.7rem}
          .admin-table th,.admin-table td{padding:6px 8px}
          .admin-pw-edit{min-width:0;width:100%}
          .admin-pw-edit input{font-size:.65rem}
          .admin-limit-edit{flex-wrap:wrap}
          .admin-head h2{font-size:1.1rem}
        }
      `}</style>
    </div>
  );
}
