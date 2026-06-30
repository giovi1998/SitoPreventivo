import { useCallback, useContext, useState } from 'react';
import { AppContext } from '../contexts';
import dataService from '../utils/dataService';
import type { Tier } from '../utils/watermark';

interface SaveResult {
  success: boolean;
  blocked?: boolean;
  error?: string;
  data?: any;
}

interface UseDocumentSaveReturn {
  save: (email: string, document: any) => Promise<SaveResult>;
  isBlocked: boolean;
  isSaving: boolean;
  showTierModal: boolean;
  closeTierModal: () => void;
  tier: Tier | 'loading';
  documentCount: number;
  documentLimit: number | null;
  refresh: () => Promise<void>;
}

/**
 * Hook that wraps `dataService.saveDocument` with the Phase-5 free-tier
 * document limit check. If the user is on the free tier and has already
 * saved 3 documents, the save is blocked and the TierLimitModal is
 * triggered (caller is expected to render it based on `showTierModal`).
 *
 * The hook also exposes `refresh()` so that after a successful unlock
 * via redeem, the caller can re-fetch the tier state and the
 * "isBlocked" gate opens up again.
 */
export function useDocumentSave(): UseDocumentSaveReturn {
  const ctx = useContext(AppContext) as any;
  const [isSaving, setIsSaving] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [internalBlocked, setInternalBlocked] = useState(false);

  const tier: Tier | 'loading' = ctx?.tier ?? 'loading';
  const documentCount: number = ctx?.documentCount ?? 0;
  const documentLimit: number | null = ctx?.documentLimit ?? null;
  const checkDocumentLimit: () => boolean = ctx?.checkDocumentLimit ?? (() => true);
  const refreshTier = ctx?.refreshTier;

  const save = useCallback(async (email: string, document: any): Promise<SaveResult> => {
    // Phase 5: gate the save with the free-tier limit check.
    // If checkDocumentLimit returns false, the TierLimitModal is shown
    // and the save is blocked. Caller is expected to render the modal
    // when `showTierModal` is true.
    if (!checkDocumentLimit()) {
      setInternalBlocked(true);
      setShowTierModal(true);
      return { success: false, blocked: true, error: 'Limite piano free raggiunto (3 documenti)' };
    }
    setIsSaving(true);
    try {
      const result: any = await dataService.saveDocument(email, document);
      if (result?.error) {
        return { success: false, error: result.error };
      }
      // Bump document count in context so the next save sees the new total.
      // saveDocument backend already increments the DB / localStorage
      // count, so we just refresh the local view to stay in sync.
      if (refreshTier) await refreshTier();
      return { success: true, data: result.data || result };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Errore salvataggio' };
    } finally {
      setIsSaving(false);
    }
  }, [checkDocumentLimit, refreshTier]);

  const closeTierModal = useCallback(() => {
    setShowTierModal(false);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshTier) await refreshTier();
  }, [refreshTier]);

  return {
    save,
    isBlocked: internalBlocked,
    isSaving,
    showTierModal,
    closeTierModal,
    tier,
    documentCount,
    documentLimit,
    refresh,
  };
}
