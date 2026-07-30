import React, { memo } from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import {
  CardFrontFields,
  CardBackFields,
  CardMediaFields,
  CardServicesFields,
  CardSocialsFields,
  CardQrAdvanced,
  CardStyleFields,
} from './index';

interface CardFormSectionsProps {
  card: BusinessCard;
  patchFront: (patch: Partial<BusinessCard['front']>) => void;
  patchBack: (patch: Partial<BusinessCard['back']>) => void;
  patchStyle: (patch: Partial<BusinessCard['style']>) => void;
  patchDecorations: (patch: Partial<BusinessCard['decorations']>) => void;
  handleUpload: (file: File, field: 'photoUrl' | 'logoUrl') => Promise<void>;
  removePhoto: () => void;
  removeLogo: () => void;
  removeCoverImage: () => void;
  removeBackCoverImage: () => void;
  uploadError: string | null;
  updateService: (idx: number, value: string) => void;
  addService: () => void;
  removeService: (idx: number) => void;
  updateSocial: (idx: number, key: 'platform' | 'url', value: string) => void;
  addSocial: () => void;
  removeSocial: (idx: number) => void;
  tier: 'free' | 'unlocked';
}

export const CardFormSections = memo(function CardFormSections({
  card,
  patchFront,
  patchBack,
  patchStyle,
  patchDecorations,
  handleUpload,
  removePhoto,
  removeLogo,
  removeCoverImage,
  removeBackCoverImage,
  uploadError,
  updateService,
  addService,
  removeService,
  updateSocial,
  addSocial,
  removeSocial,
  tier,
}: CardFormSectionsProps): React.ReactElement {
  return (
    <>
      <CardFrontFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <CardMediaFields
        card={card}
        patchFront={patchFront}
        patchBack={patchBack}
        patchStyle={patchStyle}
        onUpload={handleUpload}
        onRemovePhoto={removePhoto}
        onRemoveLogo={removeLogo}
        onRemoveCover={removeCoverImage}
        onRemoveBackCover={removeBackCoverImage}
        uploadError={uploadError}
        tier={tier}
      />
      <CardBackFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <fieldset className="card-fieldset">
        <legend>Servizi e social</legend>
        <CardServicesFields
          services={card.back.services ?? []}
          servicesLabel={card.back.servicesLabel ?? ''}
          updateService={updateService}
          addService={addService}
          removeService={removeService}
          patchBack={patchBack}
          socials={card.back.socials}
          updateSocial={updateSocial}
          addSocial={addSocial}
          removeSocial={removeSocial}
        />
        <CardSocialsFields
          services={card.back.services ?? []}
          servicesLabel={card.back.servicesLabel ?? ''}
          socials={card.back.socials}
          updateSocial={updateSocial}
          addSocial={addSocial}
          removeSocial={removeSocial}
          updateService={updateService}
          addService={addService}
          removeService={removeService}
          patchBack={patchBack}
        />
      </fieldset>
      <CardQrAdvanced card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <CardStyleFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} onPatchDecorations={patchDecorations} />
    </>
  );
});

export default CardFormSections;
