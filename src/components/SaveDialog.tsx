import React from 'react';

interface SaveDialogProps {
  open: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  // Display label for the document being saved. Defaults to "preventivo"
  // for backward compat with the original quote-only flow. Phase 7 hotfix:
  // the dialog was hardcoded to "Salva preventivo" even when saving a
  // QR, a card, or a logo, which read as a UX bug. Editors that save a
  // non-quote document pass the matching label here.
  documentLabel?: string;
  // Sample placeholder for the input. Same rationale as `documentLabel`:
  // a generic "Es. ..." that matches the current document type.
  placeholder?: string;
}

export default function SaveDialog({
  open,
  defaultName,
  onSave,
  onCancel,
  documentLabel = 'preventivo',
  placeholder,
}: SaveDialogProps) {
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

  const capitalizedLabel = documentLabel.charAt(0).toUpperCase() + documentLabel.slice(1);
  const resolvedPlaceholder = placeholder ?? `Es. ${capitalizedLabel} - Cliente`;

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
            <h3>Salva {documentLabel}</h3>
            <p>Dai un nome per identificarlo nella Collection.</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={resolvedPlaceholder}
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
