import { useState, useCallback } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import { SIZE_PRESETS_MM } from '../utils/documentSchemas';
import { generateCardPDF, generateCardPng, buildCardSvg } from '../utils/cardGenerator';
import type { Tier } from '../utils/watermark';

export type ExportingState = 'pdf' | 'png-front' | 'png-back' | null;

// Phase 2.2 refactor: estratti gli handler di export da CardEditor.tsx in
// un hook dedicato. Tutto resta client-side (PDF/PNG/SVG/JSON) come da
// vincolo CON-001. `addToast` è iniettato per il feedback.
export function useCardExport(
  card: BusinessCard,
  tier: Tier,
  addToast: (type: string, message: string, durationMs?: number) => void,
) {
  const [exporting, setExporting] = useState<ExportingState>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Non revocare immediatamente: in alcuni browser il download parte dopo
    // il tick corrente e una revoke sincrona può annullarlo. Rimuoviamo il
    // link subito, ma revoca differita dell'ObjectURL.
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const exportPdf = useCallback(async () => {
    setExporting('pdf');
    console.info('[CardExport] PDF export start', { cardId: card.id, tier });
    try {
      const bytes = await generateCardPDF(card, { tier });
      console.info('[CardExport] PDF generated', { bytes: bytes.length });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([arrayBuffer], { type: 'application/pdf' }), `card_${card.id}.pdf`);
      console.info('[CardExport] PDF download triggered');
      addToast('success', 'PDF 10-up scaricato (pronto per la tipografia)');
    } catch (err) {
      console.error('[CardExport] PDF export failed', err);
      addToast('error', err instanceof Error ? err.message : 'Errore export PDF');
    } finally {
      setExporting(null);
    }
  }, [card, tier, addToast]);

  const exportPng = useCallback(async (side: 'front' | 'back') => {
    setExporting(side === 'front' ? 'png-front' : 'png-back');
    try {
      const bytes = await generateCardPng(card, side, { tier, dpi: 300 });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([arrayBuffer], { type: 'image/png' }), `card_${card.id}_${side}.png`);
      addToast('success', `PNG ${side} scaricato (300 DPI)`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Errore export PNG');
    } finally {
      setExporting(null);
    }
  }, [card, tier, addToast]);

  const exportSvg = useCallback((side: 'front' | 'back') => {
    try {
      const dims = SIZE_PRESETS_MM[card.style.sizePreset];
      const pxW = Math.round(dims.w * 20);
      const pxH = Math.round(dims.h * 20);
      const svg = buildCardSvg(card, side, pxW, pxH);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `card_${card.id}_${side}.svg`);
      addToast('success', `SVG ${side} scaricato (vettoriale, editabile)`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Errore export SVG');
    }
  }, [card, addToast]);

  const exportJson = useCallback(() => {
    try {
      const json = JSON.stringify(card, null, 2);
      downloadBlob(new Blob([json], { type: 'application/json' }), `card_${card.id}.json`);
      addToast('success', 'JSON scaricato (backup card data)');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Errore export JSON');
    }
  }, [card, addToast]);

  return { exporting, exportPdf, exportPng, exportSvg, exportJson };
}
