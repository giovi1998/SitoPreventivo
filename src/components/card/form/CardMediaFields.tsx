import type { CardMediaFieldsProps } from './types';

export function CardMediaFields({
  card,
  patchFront,
  onUpload,
  onRemovePhoto,
  onRemoveLogo,
  onRemoveCover,
  onRemoveBackCover,
  uploadError,
  tier = 'free',
}: CardMediaFieldsProps) {
  return (
    <fieldset className="card-fieldset">
      <legend>Foto e logo</legend>
      <div className="card-field card-photo-ai-block">
        <span>Foto (fronte)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file, 'photoUrl');
          }}
          aria-label="Carica foto (fronte)"
        />
        {card.front.photoUrl && (
          <button type="button" className="card-remove-image" onClick={onRemovePhoto}>
            Rimuovi foto
          </button>
        )}
      </div>

      <div className="card-field">
        <span>Logo (fronte)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file, 'logoUrl');
          }}
          aria-label="Carica logo (fronte)"
        />
        {card.front.logoUrl && (
          <>
            <button type="button" className="card-remove-image" onClick={onRemoveLogo}>
              Rimuovi logo
            </button>
            <label className="card-field" style={{ marginTop: 8 }}>
              <span>Sfondo logo</span>
              <select
                value={card.front.logoBackground ?? 'none'}
                onChange={(e) => patchFront({ logoBackground: e.target.value as 'none' | 'card' })}
                aria-label="Sfondo del logo"
              >
                <option value="none">Nessuno (trasparente)</option>
                <option value="card">Colore del bigliettino</option>
              </select>
            </label>
          </>
        )}
      </div>

      {card.front.coverImageUrl && (
        <div className="card-field">
          <span>Cover AI (fronte)</span>
          <img
            src={card.front.coverImageUrl}
            alt="Cover AI del fronte"
            className="card-cover-thumb"
            style={{ maxWidth: 120, maxHeight: 80, objectFit: 'cover', borderRadius: 4 }}
          />
          <button type="button" className="card-remove-image" onClick={onRemoveCover}>
            Rimuovi cover AI
          </button>
        </div>
      )}

      {card.back.coverImageUrl && (
        <div className="card-field">
          <span>Cover AI (retro)</span>
          <img
            src={card.back.coverImageUrl}
            alt="Cover AI del retro"
            className="card-cover-thumb"
            style={{ maxWidth: 120, maxHeight: 80, objectFit: 'cover', borderRadius: 4 }}
          />
          <button type="button" className="card-remove-image" onClick={onRemoveBackCover}>
            Rimuovi cover AI retro
          </button>
        </div>
      )}

      {tier === 'free' && (
        <p className="card-field-hint" style={{ fontSize: '.72rem', color: '#647086' }}>
          Passa a Pro per generare foto, cover AI e decorazioni.
        </p>
      )}

      {uploadError && (
        <p className="card-upload-error" role="alert">{uploadError}</p>
      )}
    </fieldset>
  );
}
