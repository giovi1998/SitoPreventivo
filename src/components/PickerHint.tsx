import React from 'react';
import './ElementPickerPanel.css';

interface PickerHintProps {
  /** Testo principale dell'hint. */
  message: string;
  /** Dettaglio opzionale (es. "Esc per uscire"). */
  detail?: string;
}

/**
 * Hint mostrato quando la modalità picker è attiva: avvisa che le
 * interazioni normali (drag&drop, click) sono disattivate e come uscire.
 */
export default function PickerHint({ message, detail }: PickerHintProps) {
  return (
    <div className="picker-hint" role="status">
      <span className="picker-hint__icon" aria-hidden="true">🎯</span>
      <span className="picker-hint__text">
        {message}
        {detail && <span className="picker-hint__detail"> {detail}</span>}
      </span>
    </div>
  );
}
