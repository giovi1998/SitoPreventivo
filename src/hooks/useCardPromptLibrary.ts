import { useCallback, useMemo, useState } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import {
  loadPromptLibrary,
  addPromptEntry,
  removePromptEntry,
  PROMPT_LIBRARY_KEYS,
  type PromptLibraryEntry,
} from '../utils/promptLibrary';
import { buildCardPhotoBrief } from '../utils/card/photoBrief';
import { buildCardCoverPromptBrief } from '../utils/card/coverPrompt';

type AddToast = (type: string, message: string, durationMs?: number) => string;

function usePromptSlot(libraryKey: string, module: string, defaultLabel: string, addToast: AddToast) {
  const [prompt, setPrompt] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [library, setLibrary] = useState(() => loadPromptLibrary(libraryKey));

  const save = useCallback(() => {
    const text = prompt.trim();
    if (!text) {
      addToast('info', 'Scrivi un prompt prima di salvarlo.');
      return;
    }
    const label = window.prompt('Nome del prompt', text.slice(0, 40)) || text.slice(0, 40);
    setLibrary(addPromptEntry(libraryKey, {
      label: label.trim() || defaultLabel,
      prompt: text,
      module,
    }));
    addToast('success', 'Prompt salvato nella libreria.');
  }, [prompt, addToast, libraryKey, module, defaultLabel]);

  const apply = useCallback((entry: PromptLibraryEntry) => {
    if (entry.prompt) {
      setPrompt(entry.prompt);
      setShowEditor(true);
      addToast('info', `Prompt «${entry.label}» applicato.`);
    }
  }, [addToast]);

  const remove = useCallback((id: string) => {
    setLibrary(removePromptEntry(libraryKey, id));
  }, [libraryKey]);

  return { prompt, setPrompt, showEditor, setShowEditor, library, save, apply, remove };
}

export function useCardPromptLibrary(card: BusinessCard, addToast: AddToast) {
  const photo = usePromptSlot(PROMPT_LIBRARY_KEYS.cardPhoto, 'card-photo', 'Prompt foto', addToast);
  const icon = usePromptSlot(PROMPT_LIBRARY_KEYS.cardIcon, 'card-icon', 'Prompt icona', addToast);
  const cover = usePromptSlot(PROMPT_LIBRARY_KEYS.cardCover, 'card-cover', 'Prompt sfondo', addToast);

  const autoIconPrompt = useMemo(() => {
    const subject = card.front.title?.trim() || card.front.company?.trim() || 'professional business';
    return `minimal geometric icon representing ${subject}`;
  }, [card]);

  const handleFillAutoPhotoPrompt = useCallback(() => {
    photo.setPrompt(buildCardPhotoBrief(card).prompt);
    photo.setShowEditor(true);
  }, [card, photo.setPrompt, photo.setShowEditor]);

  const handleFillAutoIconPrompt = useCallback(() => {
    icon.setPrompt(autoIconPrompt);
    icon.setShowEditor(true);
  }, [autoIconPrompt, icon.setPrompt, icon.setShowEditor]);

  const handleFillAutoCoverPrompt = useCallback(() => {
    cover.setPrompt(buildCardCoverPromptBrief(card, 'front').prompt);
    cover.setShowEditor(true);
  }, [card, cover.setPrompt, cover.setShowEditor]);

  return {
    photoPrompt: photo.prompt,
    setPhotoPrompt: photo.setPrompt,
    showPhotoPromptEditor: photo.showEditor,
    setShowPhotoPromptEditor: photo.setShowEditor,
    photoLibrary: photo.library,
    handleSavePhotoPrompt: photo.save,
    handleApplyPhotoPrompt: photo.apply,
    handleDeletePhotoPrompt: photo.remove,
    handleFillAutoPhotoPrompt,
    iconPrompt: icon.prompt,
    setIconPrompt: icon.setPrompt,
    showIconPromptEditor: icon.showEditor,
    setShowIconPromptEditor: icon.setShowEditor,
    iconLibrary: icon.library,
    handleSaveIconPrompt: icon.save,
    handleApplyIconPrompt: icon.apply,
    handleDeleteIconPrompt: icon.remove,
    handleFillAutoIconPrompt,
    coverPrompt: cover.prompt,
    setCoverPrompt: cover.setPrompt,
    showCoverPromptEditor: cover.showEditor,
    setShowCoverPromptEditor: cover.setShowEditor,
    coverLibrary: cover.library,
    handleSaveCoverPrompt: cover.save,
    handleApplyCoverPrompt: cover.apply,
    handleDeleteCoverPrompt: cover.remove,
    handleFillAutoCoverPrompt,
    autoIconPrompt,
  };
}
