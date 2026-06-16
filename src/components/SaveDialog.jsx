import React from 'react';

export default function SaveDialog({ open, defaultName, onSave, onCancel }) {
  const [name, setName] = React.useState(defaultName || '');

  React.useEffect(() => {
    if (open) setName(defaultName || '');
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <div className="save-dialog-overlay" onClick={onCancel}>
      <div className="save-dialog" onClick={e => e.stopPropagation()}>
        <h3>Salva preventivo</h3>
        <p>Dai un nome per identificarlo nella Collection.</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Es. Preventivo Sito Web - Francesca"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }}
        />
        <div className="save-dialog-actions">
          <button className="btn-ghost" onClick={onCancel}>Annulla</button>
          <button className="btn-primary" onClick={() => onSave(name.trim())} disabled={!name.trim()}>Salva</button>
        </div>
      </div>
      <style>{`
        .save-dialog-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);display:grid;place-items:center;z-index:1000;padding:20px;animation:fadeIn .15s}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .save-dialog{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.15)}
        .save-dialog h3{margin:0 0 6px;font-size:1.1rem;font-weight:800;color:#07111f}
        .save-dialog p{margin:0 0 18px;font-size:.85rem;color:#647086}
        .save-dialog input{width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:.9rem;outline:none;transition:border-color .2s;box-sizing:border-box}
        .save-dialog input:focus{border-color:#0B57D0}
        .save-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
        .save-dialog-actions button{padding:10px 20px;border-radius:10px;font-weight:700;font-size:.85rem;cursor:pointer;transition:all .15s}
        .btn-ghost{background:#f1f5f9;border:none;color:#475569}
        .btn-ghost:hover{background:#e2e8f0}
        .btn-primary{background:#0B57D0;border:none;color:#fff}
        .btn-primary:hover{box-shadow:0 4px 12px rgba(11,87,208,.3)}
        .btn-primary:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
      `}</style>
    </div>
  );
}
