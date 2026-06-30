import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EditorView from '../../components/EditorView';
import { AppContext, AuthContext } from '../../contexts';

export default function EditorPage() {
  const ctx = useContext(AppContext) as any;
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Defense-in-depth: l'AdminEditorRoute in main.tsx blocca già, ma
  // questo fallback protegge da un eventuale accesso diretto.
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app/qr', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <EditorView
      quote={ctx.editingQuote}
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
      aiModel={ctx.aiModel}
      onAiModelChange={ctx.setAiModel}
      previewRef={ctx.previewRef}
      aiLogs={ctx.aiLogs}
      isProcessing={ctx.isProcessing}
      availableModels={ctx.availableModels}
      onResetChat={ctx.resetChat}
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
    />
  );
}
