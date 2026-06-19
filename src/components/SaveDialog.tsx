import React from 'react';

interface SaveDialogProps {
  open: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

export default function SaveDialog({ open, defaultName, onSave, onCancel }: SaveDialogProps) {
  const [name, setName] = React.useState(defaultName || '');
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  React.useEffect(() => {
    if (open) { setName(defaultName || ''); setConfirmCancel(false); }
  }, [open, defaultName]);

  if (!open) return null;

  const handleCancel = () => {
    if (name !== defaultName && !confirmCancel) {
      setConfirmCancel(true);
    } else {
      onCancel();
    }
  };

  return (
    <div className="save-dialog-overlay" onClick={handleCancel}>
      <div className="save-dialog" onClick={e => e.stopPropagation()}>
        {confirmCancel ? (
          <>
            <h3>Annulla salvataggio?</h3>
            <p>Le modifiche al nome non verranno salvate.</p>
            <div className="save-dialog-actions">
              <button className="btn-ghost" onClick={onCancel}>Sì, annulla</button>
              <button className="btn-primary" onClick={() => setConfirmCancel(false)}>Continua a modificare</button>
            </div>
          </>
        ) : (
          <>
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
              <button className="btn-ghost" onClick={handleCancel}>Annulla</button>
              <button className="btn-primary" onClick={() => onSave(name.trim())} disabled={!name.trim()}>Salva</button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
