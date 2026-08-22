import { useState, useRef, useEffect, useCallback } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import { pruneCardGrids } from '../utils/card/gridElements';
import { compressCardImages } from '../utils/card/saveCompression';
import { logger } from '../utils/logger';
import dataService from '../utils/dataService';

const AUTO_SAVE_DELAY_MS = 30_000;

export function cardHasContent(c: BusinessCard): boolean {
  return !!(
    c.title?.trim()
    || c.front.name?.trim()
    || c.front.title?.trim()
    || c.front.company?.trim()
    || c.front.photoUrl
    || c.front.logoUrl
    || c.front.coverImageUrl
    || c.back.phone?.trim()
    || c.back.email?.trim()
    || c.back.website?.trim()
    || c.back.address?.trim()
    || c.back.vatNumber?.trim()
    || (c.back.services ?? []).some((s) => s.trim())
    || c.back.socials.some((s) => s.url?.trim())
    || c.back.qrPayload?.trim()
    || c.back.coverImageUrl
  );
}

export function defaultCardTitle(c: BusinessCard): string {
  if (c.title?.trim()) return c.title.trim();
  if (c.front.name?.trim()) return `Bigliettino ${c.front.name.trim()}`;
  return 'Bigliettino';
}

function customerPatchFromCard(card: BusinessCard): Record<string, unknown> | null {
  const customerId = (card as unknown as { customerId?: string }).customerId;
  if (!customerId) return null;
  const patch: Record<string, unknown> = {};
  const contacts: Record<string, string> = {};
  if (card.back.phone?.trim()) contacts.phone = card.back.phone.trim();
  if (card.back.email?.trim()) contacts.email = card.back.email.trim();
  if (card.back.website?.trim()) contacts.website = card.back.website.trim();
  if (card.back.address?.trim()) contacts.address = card.back.address.trim();
  if (Object.keys(contacts).length) patch.contacts = contacts;
  if (card.back.socials?.length) patch.socials = card.back.socials;
  if (card.front.company?.trim()) patch.businessName = card.front.company.trim();
  if (card.front.name?.trim()) patch.ownerName = card.front.name.trim();
  if (card.front.title?.trim()) patch.sector = card.front.title.trim();
  const style = (card as unknown as { style?: { fontFamily?: string; accentColor?: string } }).style;
  if (style?.fontFamily) patch.font = style.fontFamily;
  if (style?.accentColor) patch.preferredColors = style.accentColor;
  if (Object.keys(patch).length === 0) return null;
  return patch;
}

function syncCardToCustomer(card: BusinessCard): void {
  const patch = customerPatchFromCard(card);
  if (!patch) return;
  const customerId = (card as unknown as { customerId?: string }).customerId!;
  dataService.updateCustomer(customerId, { ...patch, skipSync: true } as Record<string, unknown>).catch((err) => {
    logger.warn('Sync card→customer fallito', { err: String(err) });
  });
}

interface UseCardAutoSaveOptions {
  card: BusinessCard;
  setCard: React.Dispatch<React.SetStateAction<BusinessCard>>;
  userEmail: string;
  saveDocumentGuarded: (userEmail: string, doc: BusinessCard) => Promise<{ blocked?: boolean; error?: string; data?: unknown }>;
  loadedIdRef: React.MutableRefObject<string | undefined>;
  addToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
  onSaved?: (doc: any) => void;
}

export function useCardAutoSave({
  card,
  setCard,
  userEmail,
  saveDocumentGuarded,
  loadedIdRef,
  addToast,
  onSaved,
}: UseCardAutoSaveOptions) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoSaveRef = useRef<{ email: string; card: BusinessCard } | null>(null);
  const saveFnRef = useRef(saveDocumentGuarded);
  const justSavedRef = useRef(false);

  useEffect(() => {
    saveFnRef.current = saveDocumentGuarded;
  }, [saveDocumentGuarded]);

  const openSaveDialog = useCallback(() => {
    if (!userEmail) {
      addToast('error', 'Devi essere loggato per salvare.');
      return;
    }
    if (!cardHasContent(card)) {
      addToast('info', 'Compila almeno nome o contatti prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [card, userEmail, addToast]);

  const handleSave = useCallback(async (customName?: string) => {
    try {
      if (!userEmail) {
        addToast('error', 'Devi essere loggato per salvare.');
        return;
      }
      const title = (customName?.trim() || defaultCardTitle(card));
      const pruned = pruneCardGrids(card);
      const sanitized: BusinessCard = {
        ...(await compressCardImages(pruned)),
        title,
        userEmail,
        updatedAt: new Date().toISOString(),
      };
      const result = await saveDocumentGuarded(userEmail, sanitized);
      if (result.blocked) {
        addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        return;
      }
      if (result.error) {
        addToast('error', result.error);
        return;
      }
      justSavedRef.current = true;
      setCard(sanitized);
      setIsSaved(true);
      loadedIdRef.current = sanitized.id;
      setShowSaveDialog(false);
      addToast('success', `«${title}» salvato. Visibile in Collection.`);
      if (onSaved) onSaved(sanitized);
      syncCardToCustomer(sanitized);
    } catch (err: any) {
      logger.error('Card save failed', { err: err?.message || String(err) });
      addToast('error', `Errore durante il salvataggio: ${err?.message || 'sconosciuto'}`);
    }
  }, [card, userEmail, addToast, saveDocumentGuarded, onSaved, setCard, loadedIdRef]);

  // Auto-save timer effect
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    pendingAutoSaveRef.current = null;
    if (!userEmail || !cardHasContent(card)) return;
    pendingAutoSaveRef.current = { email: userEmail, card };
    autoSaveTimerRef.current = setTimeout(() => {
      pendingAutoSaveRef.current = null;
      const title = defaultCardTitle(card);
      const pruned = pruneCardGrids(card);
      compressCardImages(pruned).then((compressed) => {
        const sanitized: BusinessCard = {
          ...compressed,
          title,
          userEmail,
          updatedAt: new Date().toISOString(),
        };
        saveDocumentGuarded(userEmail, sanitized).then((result) => {
          if (result.blocked) {
            addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
          } else if (result.error) {
            logger.error('Card auto-save failed', { err: result.error });
            addToast('error', `Salvataggio automatico non riuscito: ${result.error}`);
          } else {
            if (card.title !== title) {
              justSavedRef.current = true;
              setCard((prev) => (prev.title === title ? prev : { ...prev, title }));
            }
            setIsSaved(true);
            if (onSaved && sanitized.id) onSaved(sanitized);
            syncCardToCustomer(sanitized);
          }
        });
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [card, userEmail, saveDocumentGuarded, addToast, onSaved, setCard]);

  // Dirty tracking effect
  useEffect(() => {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      return;
    }
    setIsSaved(false);
  }, [card]);

  // Flush on unmount effect
  useEffect(() => {
    return () => {
      const pending = pendingAutoSaveRef.current;
      pendingAutoSaveRef.current = null;
      if (!pending) return;
      const title = defaultCardTitle(pending.card);
      const sanitized: BusinessCard = {
        ...pruneCardGrids(pending.card),
        title,
        userEmail: pending.email,
        updatedAt: new Date().toISOString(),
      };
      void saveFnRef.current(pending.email, sanitized).then((result) => {
        if (result?.error) logger.error('Card flush-save on unmount failed', { err: result.error });
      });
    };
  }, []);

  return {
    showSaveDialog,
    setShowSaveDialog,
    isSaved,
    setIsSaved,
    openSaveDialog,
    handleSave,
    justSavedRef,
  };
}
