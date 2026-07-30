import { useCallback, useMemo } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import { gridPresetBackDefault } from '../utils/documentSchemas';
import { isHttpUrl } from '../utils/qrGenerator';
import { pushLayoutEvent } from '../utils/card/layoutEvents';

interface UseCardBackContentOptions {
  card: BusinessCard;
  setCard: React.Dispatch<React.SetStateAction<BusinessCard>>;
}

export function useCardBackContent({ card, setCard }: UseCardBackContentOptions) {
  const updateSocial = useCallback((idx: number, key: 'platform' | 'url', value: string) => {
    setCard((prev) => {
      const socials = [...prev.back.socials];
      socials[idx] = { ...socials[idx], [key]: value };
      return { ...prev, back: { ...prev.back, socials }, updatedAt: new Date().toISOString() };
    });
  }, [setCard]);

  const ensureBackGridElement = useCallback(
    (prev: BusinessCard, key: 'services' | 'socials'): BusinessCard['backGrid'] => {
      const backGrid = prev.backGrid;
      if (!backGrid) return backGrid;
      if (backGrid.elements[key]) return backGrid;
      const preset = gridPresetBackDefault();
      const presetEl = preset.elements[key];
      if (!presetEl) return backGrid;
      return {
        ...backGrid,
        elements: { ...backGrid.elements, [key]: presetEl },
      };
    },
    [],
  );

  const addSocial = useCallback(() => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: [...prev.back.socials, { platform: '', url: '' }] },
      backGrid: ensureBackGridElement(prev, 'socials'),
      updatedAt: new Date().toISOString(),
    }));
  }, [setCard, ensureBackGridElement]);

  const removeSocial = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: prev.back.socials.filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, [setCard]);

  const addService = useCallback(() => {
    setCard((prev) => {
      const current = prev.back.services ?? [];
      if (current.length >= 8) return prev;
      return {
        ...prev,
        back: { ...prev.back, services: [...current, ''] },
        backGrid: ensureBackGridElement(prev, 'services'),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [setCard, ensureBackGridElement]);

  const updateService = useCallback((idx: number, value: string) => {
    setCard((prev) => {
      const services = [...(prev.back.services ?? [])];
      services[idx] = value.slice(0, 80);
      return {
        ...prev,
        back: { ...prev.back, services },
        backGrid: value.trim() ? ensureBackGridElement(prev, 'services') : prev.backGrid,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [setCard, ensureBackGridElement]);

  const removeService = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, services: (prev.back.services ?? []).filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, [setCard]);

  const patchDecorations = useCallback((patch: Partial<BusinessCard['decorations']>) => {
    pushLayoutEvent({ type: 'card.edit', element: 'decorations', result: 'ok', payload: { fields: Object.keys(patch) } });
    setCard((prev) => ({
      ...prev,
      decorations: { ...(prev.decorations ?? { pattern: null, opacity: 0.2 }), ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, [setCard]);

  const websiteValid = useMemo(() => !card.back.website || isHttpUrl(card.back.website), [card.back.website]);

  return {
    updateSocial,
    addSocial,
    removeSocial,
    addService,
    updateService,
    removeService,
    patchDecorations,
    websiteValid,
    ensureBackGridElement,
  };
}
