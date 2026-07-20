import type {
  BusinessCard,
  BusinessCardLayout,
  BusinessCardBorderStyle,
  BusinessCardSizePreset,
  BusinessCardQrSize,
} from '../../../utils/documentSchemas';

export interface CardSectionProps {
  card: BusinessCard;
  patchFront: (p: Partial<BusinessCard['front']>) => void;
  patchBack: (p: Partial<BusinessCard['back']>) => void;
  patchStyle: (p: Partial<BusinessCard['style']>) => void;
}

export interface CardMediaFieldsProps extends CardSectionProps {
  onUpload: (file: File, field: 'photoUrl' | 'logoUrl') => void;
  onRemovePhoto: () => void;
  onRemoveLogo: () => void;
  onRemoveCover?: () => void;
  onRemoveBackCover?: () => void;
  uploadError: string | null;
  tier?: 'free' | 'unlocked';
}

export interface CardSocialsState {
  socials: BusinessCard['back']['socials'];
  updateSocial: (idx: number, key: 'platform' | 'url', value: string) => void;
  addSocial: () => void;
  removeSocial: (idx: number) => void;
  services?: BusinessCard['back']['services'];
  servicesLabel?: string;
  updateService?: (idx: number, value: string) => void;
  addService?: () => void;
  removeService?: (idx: number) => void;
  patchBack?: (p: Partial<BusinessCard['back']>) => void;
}

export interface CardServicesState {
  services: BusinessCard['back']['services'];
  servicesLabel: string;
  updateService: (idx: number, value: string) => void;
  addService: () => void;
  removeService: (idx: number) => void;
  patchBack: (p: Partial<BusinessCard['back']>) => void;
  socials?: BusinessCard['back']['socials'];
  updateSocial?: (idx: number, key: 'platform' | 'url', value: string) => void;
  addSocial?: () => void;
  removeSocial?: (idx: number) => void;
}

export type {
  BusinessCard,
  BusinessCardLayout,
  BusinessCardBorderStyle,
  BusinessCardSizePreset,
  BusinessCardQrSize,
};
