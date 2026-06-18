import React from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onCancel}>Annulla</button>
          <button
            className={confirmClass === 'danger' ? 'btn-remove' : 'btn-primary'}
            onClick={onConfirm}
          >{confirmLabel || 'Conferma'}</button>
        </div>
      </div>
    </div>
  );
}
