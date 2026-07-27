import React, { useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EditorView from '../../components/EditorView';
import { AppContext, AuthContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';
import { migrateFromLegacy, recalculateQuote, type PremiumQuote } from '../../utils/quoteSchema';

export default function EditorPage() {
  const ctx = useContext(AppContext) as any;
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { initialDoc, onReset, onSaved } = useDocumentLoader({
    view: 'editor',
    documentType: 'quote',
    contextField: 'editingQuote',
  });
  const onProviderChange = ctx.onAiProviderChange;

  // Defense-in-depth: l'AdminEditorRoute in main.tsx blocca già, ma
  // questo fallback protegge da un eventuale accesso diretto.
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app/qr', { replace: true });
    }
  }, [user, navigate]);

  // useDocumentLoader carica doc grezzo (legacy flat o PremiumQuote
  // parziale) e lo scrive in ctx.editingQuote. EditorView assume
  // PremiumQuote idratato (options/items/tax). Migr sempre, anche se
  // doc sembra già PremiumQuote: migrateFromLegacy è idempotente su
  // `_premium` e idrata campi mancanti. recalculateQuote ricalcola
  // totali per coerenza. Bug fix: prima initialDoc legacy flat →
  // EditorView crash su quote.options[0].items[0].tax.rate.
  const quote = useMemo<PremiumQuote>(() => {
    const src = initialDoc || ctx.editingQuote;
    if (!src) return ctx.editingQuote;
    try {
      const migrated = migrateFromLegacy(src as any);
      return recalculateQuote(migrated);
    } catch {
      return src as PremiumQuote;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoc]);

  // Sync il quote migrato sul ctx state così patch/save operano sullo
  // stesso oggetto idratato. Solo se diverso per evitare loop.
  useEffect(() => {
    if (quote && ctx.editingQuote !== quote && ctx.setEditingQuote) {
      ctx.setEditingQuote(quote);
    }
  }, [quote, ctx.editingQuote, ctx.setEditingQuote]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <EditorView
      quote={quote}
      aiText={ctx.aiText}
      setAiText={ctx.setAiText}
      patch={ctx.patch}
      updateOption={ctx.updateOption}
      updateOptions={ctx.updateOptions}
      addOption={ctx.addOption}
      removeOption={ctx.removeOption}
      updateClause={ctx.updateClause}
      addClause={ctx.addClause}
      removeClause={ctx.removeClause}
      onRunAI={ctx.runAI}
      previewRef={ctx.previewRef}
      aiLogs={ctx.aiLogs}
      isProcessing={ctx.isProcessing}
      onResetChat={ctx.resetChat}
      onReset={onReset}
      isDirty={ctx.isDirty}
      saveQuote={ctx.saveCurrentQuote}
      documentTheme={ctx.documentTheme}
      onSave={ctx.saveQuote}
      onExportPDF={ctx.exportPDF}
      onExportDOCX={ctx.exportDOCX}
      onImportPDF={ctx.onImportPDF}
      onSaveAsTemplate={ctx.saveAsTemplate}
      lastSaveTime={ctx.lastSaveTime}
      pdfLoading={ctx.pdfLoading}
      docxLoading={ctx.docxLoading}
      lastCostUsd={ctx.lastCostUsd}
      onProviderChange={onProviderChange}
    />
  );
}
