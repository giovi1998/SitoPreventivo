import React from 'react';
import type { Flyer } from '../../utils/documentSchemas';

interface FlyerExportActionsProps {
  flyer: Flyer;
  limitReached: boolean;
  exporting: 'pdf' | 'png' | null;
  hasContent: boolean;
  onReset: () => void;
  onSave: () => void;
  onExportPdf: () => void;
  onExportPng: () => void;
}

export function FlyerExportActions({ limitReached, exporting, hasContent, onReset, onSave, onExportPdf, onExportPng }: FlyerExportActionsProps): React.ReactElement {
  return (
    <>
      <div className="editor-actions-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={onReset}>Nuovo</button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={limitReached}>Salva</button>
        <button type="button" onClick={onExportPdf} disabled={exporting !== null || !hasContent || limitReached}>{exporting === 'pdf' ? '…' : 'PDF'}</button>
        <button type="button" onClick={onExportPng} disabled={exporting !== null || !hasContent || limitReached}>{exporting === 'png' ? '…' : 'PNG'}</button>
      </div>
      {limitReached && <p className="qr-warning" role="status" style={{ fontSize: '.78rem' }}>🔒 Limite free raggiunto. Sblocca per salvare ed esportare.</p>}
    </>
  );
}

export default FlyerExportActions;
