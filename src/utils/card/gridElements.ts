import type { BusinessCard, CardGrid } from '../documentSchemas';

export type GridElementKey =
  | 'photo'
  | 'name'
  | 'title'
  | 'company'
  | 'logo'
  | 'qr'
  | 'contacts'
  | 'socials';

export type GridSide = 'front' | 'back';

export interface GridElementOption {
  value: GridElementKey;
  label: string;
}

export const FRONT_ELEMENT_KEYS: readonly GridElementKey[] = [
  'photo',
  'name',
  'title',
  'company',
  'logo',
];

export const BACK_ELEMENT_KEYS: readonly GridElementKey[] = [
  'contacts',
  'qr',
  'socials',
];

export function elementKeysForSide(side: GridSide): readonly GridElementKey[] {
  return side === 'front' ? FRONT_ELEMENT_KEYS : BACK_ELEMENT_KEYS;
}

export function hasElementContent(
  key: GridElementKey,
  card: BusinessCard,
  side: GridSide,
): boolean {
  if (side === 'front') {
    if (key === 'photo') return !!card.front.photoUrl;
    if (key === 'logo') return !!card.front.logoUrl;
    if (key === 'name') return card.front.name.trim().length > 0;
    if (key === 'title') return card.front.title.trim().length > 0;
    if (key === 'company') return card.front.company.trim().length > 0;
    return false;
  }
  // back
  if (key === 'contacts') {
    return !!(
      card.back.phone.trim() ||
      card.back.email.trim() ||
      card.back.website.trim() ||
      card.back.address.trim() ||
      card.back.vatNumber.trim()
    );
  }
  if (key === 'qr') {
    return !!(card.back.qrPayload.trim() || card.back.website.trim());
  }
  if (key === 'socials') {
    return card.back.socials.some((s) => s.platform && s.url);
  }
  return false;
}

const LABELS: Record<GridElementKey, string> = {
  photo: 'Foto',
  name: 'Nome',
  title: 'Ruolo',
  company: 'Azienda',
  logo: 'Logo',
  contacts: 'Contatti',
  qr: 'QR',
  socials: 'Social',
};

export function allElementOptionsForSide(side: GridSide): GridElementOption[] {
  return elementKeysForSide(side).map((key) => ({ value: key, label: LABELS[key] }));
}

export function getAvailableGridElements(
  side: GridSide,
  card: BusinessCard,
): GridElementOption[] {
  return elementKeysForSide(side)
    .filter((key) => hasElementContent(key, card, side))
    .map((key) => ({ value: key, label: LABELS[key] }));
}

export function hasGridElements(side: GridSide, card: BusinessCard): boolean {
  const grid = side === 'back' ? card.backGrid : card.grid;
  if (!grid) return false;
  for (const [key, rect] of Object.entries(grid.elements)) {
    if (rect && hasElementContent(key as GridElementKey, card, side)) return true;
  }
  return false;
}
