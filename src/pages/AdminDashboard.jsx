import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../App.jsx';
import dataService from '../utils/dataService.js';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitValue, setLimitValue] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    dataService.adminGetUsers().then(({ users: list }) => setUsers(list || []));
    dataService.adminGetAllQuotes().then(({ quotes: list }) => setQuotes(list || []));
    dataService.getDeepseekKey().then(setDeepseekKey);
  }, []);

  const saveKey = async () => {
    await dataService.saveDeepseekKey(deepseekKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const totalTokens = users.reduce((s, u) => s + (u.tokensUsed || 0), 0);
  const totalTokenLimit = users.reduce((s, u) => s + (u.tokenLimit || 0), 0);

  const handleSetLimit = async (email) => {
    const val = parseInt(limitValue, 10);
    if (isNaN(val) || val < 0) return;
    await dataService.adminUpdateLimits(email, val);
    setEditingLimit(null);
    setLimitValue('');
    // Refresh
    const { users: list } = await dataService.adminGetUsers();
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
        <h3>Chiave DeepSeek (condivisa)</h3>
        <div className="admin-apikey">
          <input type="password" value={deepseekKey} onChange={e => setDeepseekKey(e.target.value)} placeholder="sk-..." />
          <button onClick={saveKey}>{keySaved ? 'Salvata!' : 'Salva chiave'}</button>
        </div>
      </div>

      <div className="admin-section">
        <h3>Utenti</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Username</th><th>Sesso</th><th>Ruolo</th><th>Registrato</th><th>Token usati</th><th>Limite token</th><th>Azioni</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.username}</td>
                  <td>{u.gender || '-'}</td>
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
        .admin-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .admin-head h2{margin:0;font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
        .admin-head span{font-size:.85rem;color:#647086}
        .admin-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px}
        .admin-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center}
        .admin-stat b{display:block;font-size:1.6rem;font-weight:900;color:#0B57D0}
        .admin-stat span{font-size:.8rem;color:#647086;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
        .admin-section{margin-bottom:28px}
        .admin-section h3{font-size:1rem;font-weight:800;margin:0 0 12px}
        .admin-table-wrap{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px}
        .admin-table{width:100%;border-collapse:collapse;font-size:.82rem;white-space:nowrap}
        .admin-table th,.admin-table td{padding:10px 14px;text-align:left;border-bottom:1px solid #f1f5f9}
        .admin-table th{background:#f8fafc;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#647086}
        .admin-table tr:last-child td{border-bottom:none}
        .admin-role{padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:700;text-transform:uppercase}
        .admin-role.admin{background:#e8f0fe;color:#0B57D0}
        .admin-role.user{background:#f0f1f5;color:#666c7c}
        .admin-status{padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600}
        .admin-status.bozza{background:#f0f1f5;color:#666c7c}
        .admin-status.inviato{background:#e6eefc;color:#0B57D0}
        .admin-status.accettato{background:#f7eddc;color:#a66200}
        .admin-status.rifiutato{background:#fef2f2;color:#dc2626}
        .admin-limit-edit{display:flex;gap:4px;align-items:center}
        .admin-limit-edit input{width:80px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:.8rem}
        .admin-limit-edit button{padding:4px 8px;border:none;border-radius:6px;font-size:.72rem;font-weight:600;cursor:pointer;background:#0B57D0;color:#fff}
        .admin-limit-edit .btn-ghost{background:transparent;color:#647086}
        .admin-table td button{padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;font-size:.72rem;font-weight:600;cursor:pointer;transition:border-color .15s}
        .admin-table td button:hover{border-color:#0B57D0;color:#0B57D0}
        .admin-apikey{display:flex;gap:8px;align-items:center;margin-bottom:20px}
        .admin-apikey input{flex:1;max-width:400px;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:.9rem;font-family:monospace;outline:none;transition:border-color .2s}
        .admin-apikey input:focus{border-color:#0B57D0}
        .admin-apikey button{padding:10px 20px;border:none;border-radius:10px;background:#0B57D0;color:#fff;font-weight:700;font-size:.85rem;cursor:pointer;transition:box-shadow .2s}
        .admin-apikey button:hover{box-shadow:0 4px 12px rgba(11,87,208,.3)}
        @media(max-width:640px){.admin-stats{grid-template-columns:1fr 1fr}.admin-dashboard{padding:16px}}
      `}</style>
    </div>
  );
}
