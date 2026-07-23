import type {
  BusinessCardLayout,
  BusinessCardSizePreset,
  BusinessCardBorderStyle,
  BusinessCardQrSize,
} from '../../utils/documentSchemas';
import { QR_SIZE_PX } from '../../utils/documentSchemas';

export const LAYOUT_LABELS: Record<BusinessCardLayout, string> = {
  centered: 'Centrato',
  left: 'Sinistra (foto a sx)',
  split: 'Split (foto a sx)',
  right: 'Split inverso (foto a dx)',
  'right-balanced': 'Bilanciato DX (foto a dx)',
  top: 'Foto in alto',
  bottom: 'Foto in basso',
  minimal: 'Minimal (testo centrato)',
  'photo-circle': 'Foto tonda centrata',
  compact: 'Compatto (colonna foto)',
};

export const SIZE_PRESET_LABELS: Record<BusinessCardSizePreset, string> = {
  'eu-85x55': 'EU 85×55mm',
  'us-89x51': 'US 89×51mm',
  'square-65x65': 'Quadrato 65×65mm',
};

export const BORDER_LABELS: Record<BusinessCardBorderStyle, string> = {
  none: 'Nessuno',
  thin: 'Bordo sottile',
  'accent-strip-left': 'Striscia accento a sinistra',
  'accent-strip-bottom': 'Striscia accento in basso',
};

export const QR_SIZE_LABELS: Record<BusinessCardQrSize, string> = {
  small: `Piccolo (${QR_SIZE_PX.small}px)`,
  medium: `Medio (${QR_SIZE_PX.medium}px)`,
  large: `Grande (${QR_SIZE_PX.large}px)`,
};

export const SOCIAL_PLATFORMS = [
  { value: '', label: ':' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'GitHub', label: 'GitHub' },
  { value: 'X', label: 'X (Twitter)' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Behance', label: 'Behance' },
  { value: 'Dribbble', label: 'Dribbble' },
] as const;
