import React from 'react';
import type {
  BusinessCard,
  BusinessCardLayout,
  BusinessCardBorderStyle,
  BusinessCardSizePreset,
  BusinessCardQrSize,
} from '../../utils/documentSchemas';
import {
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
} from '../../utils/documentSchemas';
import {
  LAYOUT_LABELS,
  SIZE_PRESET_LABELS,
  BORDER_LABELS,
  QR_SIZE_LABELS,
  SOCIAL_PLATFORMS,
} from './labels';
import { AiFontPicker, AiPromptTextarea, AiPromptLibrary } from '../ai-ui';

export { LAYOUT_LABELS, SIZE_PRESET_LABELS, BORDER_LABELS, QR_SIZE_LABELS, SOCIAL_PLATFORMS };

// Phase 2.2 REQ-B02: componenti estratti per il form del bigliettino.
// Sono condivisi tra desktop 3-colonne e tab mobile "Modifica", per
// garantire parità di funzionalità (foto, logo, servizi, social, QR,
// stile, font, fontScale sono presenti in entrambi i viewport).

// ─── Props condivise ───────────────────────────────────────
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
  onGeneratePhoto?: () => void;
  isGeneratingPhoto?: boolean;
  photoPrompt?: string;
  setPhotoPrompt?: (v: string) => void;
  showPhotoPromptEditor?: boolean;
  setShowPhotoPromptEditor?: (v: boolean) => void;
  photoLibrary?: import('../../utils/promptLibrary').PromptLibraryEntry[];
  onSavePhotoPrompt?: () => void;
  onApplyPhotoPrompt?: (entry: import('../../utils/promptLibrary').PromptLibraryEntry) => void;
  onDeletePhotoPrompt?: (id: string) => void;
  onFillAutoPhotoPrompt?: () => void;
}

export interface CardSocialsState {
  socials: BusinessCard['back']['socials'];
  updateSocial: (idx: number, key: 'platform' | 'url', value: string) => void;
  addSocial: () => void;
  removeSocial: (idx: number) => void;
  // Phase 2.2: i seguenti sono richiesti dal pattern "combo" con services
  // (vedi CardEditor formAndActionsContent). Mantenuti opzionali per
  // backward-compat con chiamate singole (es. test).
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
  // Phase 2.2: opzionali per backward-compat con chiamate singole
  socials?: BusinessCard['back']['socials'];
  updateSocial?: (idx: number, key: 'platform' | 'url', value: string) => void;
  addSocial?: () => void;
  removeSocial?: (idx: number) => void;
}

// ─── CardFrontFields ───────────────────────────────────────
export function CardFrontFields({ card, patchFront }: CardSectionProps) {
  return (
    <fieldset className="card-fieldset">
      <legend>Fronte</legend>
      <label className="card-field">
        <span>Nome (fronte)</span>
        <input
          type="text"
          value={card.front.name}
          onChange={(e) => patchFront({ name: e.target.value })}
          aria-label="Nome (fronte)"
        />
      </label>
      <label className="card-field">
        <span>Ruolo (fronte)</span>
        <input
          type="text"
          value={card.front.title}
          onChange={(e) => patchFront({ title: e.target.value })}
          aria-label="Ruolo (fronte)"
        />
      </label>
      <label className="card-field">
        <span>Azienda (fronte)</span>
        <input
          type="text"
          value={card.front.company}
          onChange={(e) => patchFront({ company: e.target.value })}
          aria-label="Azienda (fronte)"
        />
      </label>
      <label className="card-field">
        <span>Layout fronte</span>
        <select
          value={card.front.layout}
          onChange={(e) => patchFront({ layout: e.target.value as BusinessCardLayout })}
          aria-label="Layout fronte"
        >
          {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

// ─── CardMediaFields (foto + logo + sfondo logo) ───────────
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
  onGeneratePhoto,
  isGeneratingPhoto = false,
  photoPrompt = '',
  setPhotoPrompt,
  showPhotoPromptEditor = false,
  setShowPhotoPromptEditor,
  photoLibrary = [],
  onSavePhotoPrompt,
  onApplyPhotoPrompt,
  onDeletePhotoPrompt,
  onFillAutoPhotoPrompt,
}: CardMediaFieldsProps) {
  const photoLocked = tier !== 'unlocked';
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
        {onGeneratePhoto && (
          <div className="card-photo-ai-actions">
            {setShowPhotoPromptEditor && !photoLocked && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowPhotoPromptEditor(!showPhotoPromptEditor)}
                disabled={isGeneratingPhoto}
                aria-expanded={showPhotoPromptEditor}
              >
                {showPhotoPromptEditor ? 'Nascondi prompt' : 'Modifica prompt'}
              </button>
            )}
            {showPhotoPromptEditor && setPhotoPrompt && !photoLocked && (
              <div className="card-photo-prompt-editor" data-testid="card-photo-prompt-editor">
                <AiPromptTextarea
                  label="Prompt foto AI"
                  value={photoPrompt}
                  onChange={(e) => setPhotoPrompt(e.target.value.slice(0, 1000))}
                  rows={4}
                  maxLength={1000}
                  placeholder="Vuoto = prompt automatico da ruolo/servizi. Es. cane stilizzato per dogsitter, verdure per nutrizionista…"
                  aria-label="Prompt foto AI"
                />
                {onFillAutoPhotoPrompt && (
                  <button type="button" className="btn-secondary" onClick={onFillAutoPhotoPrompt} disabled={isGeneratingPhoto}>
                    Usa prompt automatico
                  </button>
                )}
                {onSavePhotoPrompt && onApplyPhotoPrompt && onDeletePhotoPrompt && (
                  <AiPromptLibrary
                    items={photoLibrary}
                    onSave={onSavePhotoPrompt}
                    onApply={onApplyPhotoPrompt}
                    onDelete={onDeletePhotoPrompt}
                    saveDisabled={!photoPrompt.trim()}
                    title="I miei prompt foto"
                  />
                )}
              </div>
            )}
            <button
              type="button"
              className="card-action-primary"
              onClick={onGeneratePhoto}
              disabled={isGeneratingPhoto || photoLocked}
              title={photoLocked ? 'Disponibile nella versione Pro' : 'Genera illustrazione professionale basata su ruolo e servizi'}
              data-testid="card-generate-photo-ai"
            >
              {isGeneratingPhoto ? 'Generazione…' : photoLocked ? '🔒 Genera foto AI (Pro)' : '✨ Genera foto AI'}
            </button>
          </div>
        )}
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

      {uploadError && <p className="card-warning" role="alert">{uploadError}</p>}
    </fieldset>
  );
}

// ─── CardBackFields (contatti + indirizzo + P.IVA) ─────────
export function CardBackFields({ card, patchBack }: CardSectionProps) {
  const websiteValid = !card.back.website || /^https?:\/\//.test(card.back.website.trim());
  return (
    <fieldset className="card-fieldset">
      <legend>Retro</legend>
      <label className="card-field">
        <span>Telefono (retro)</span>
        <input
          type="tel"
          value={card.back.phone}
          onChange={(e) => patchBack({ phone: e.target.value })}
          aria-label="Telefono (retro)"
        />
      </label>
      <label className="card-field">
        <span>Email (retro)</span>
        <input
          type="email"
          value={card.back.email}
          onChange={(e) => patchBack({ email: e.target.value })}
          aria-label="Email (retro)"
        />
      </label>
      <label className="card-field">
        <span>Sito web (http:// o https://)</span>
        <input
          type="url"
          value={card.back.website}
          onChange={(e) => patchBack({ website: e.target.value })}
          aria-invalid={!websiteValid}
          aria-label="Sito web"
          placeholder="https://..."
        />
        {!websiteValid && <small className="card-warning">URL non valido. Includi http:// o https://</small>}
      </label>
      <label className="card-field">
        <span>Indirizzo</span>
        <input
          type="text"
          value={card.back.address}
          onChange={(e) => patchBack({ address: e.target.value })}
          aria-label="Indirizzo"
        />
      </label>
      <label className="card-field">
        <span>P.IVA</span>
        <input
          type="text"
          value={card.back.vatNumber}
          onChange={(e) => patchBack({ vatNumber: e.target.value })}
          aria-label="P.IVA"
        />
      </label>
    </fieldset>
  );
}

// ─── CardServicesFields (lista servizi + label) ────────────
export function CardServicesFields({
  services,
  servicesLabel,
  updateService,
  addService,
  removeService,
  patchBack,
}: CardServicesState) {
  return (
    <div className="card-field" data-testid="card-services-field">
      <span>Servizi offerti (max 8)</span>
      <p className="card-field-hint" style={{ fontSize: '.72rem', color: '#647086', margin: '2px 0 6px' }}>
        Es. "Web Design", "SEO", "Consulenza", visualizzati sul retro
      </p>
      <label className="card-field" style={{ marginTop: 4 }}>
        <span>Etichetta sopra i servizi</span>
        <input
          type="text"
          value={servicesLabel}
          onChange={(e) => patchBack({ servicesLabel: e.target.value })}
          maxLength={40}
          placeholder='Es. "Servizi che offro" (vuoto = nessuna etichetta)'
          aria-label="Etichetta lista servizi"
          data-testid="card-services-label"
        />
      </label>
      {services.map((svc, idx) => (
        <div key={idx} className="card-social-row">
          <input
            type="text"
            value={svc}
            onChange={(e) => updateService(idx, e.target.value)}
            placeholder={`Servizio ${idx + 1}`}
            maxLength={80}
            aria-label={`Servizio ${idx + 1}`}
          />
          <button
            type="button"
            onClick={() => removeService(idx)}
            aria-label={`Rimuovi servizio ${idx + 1}`}
          >×</button>
        </div>
      ))}
      {services.length < 8 && (
        <button
          type="button"
          onClick={addService}
          className="card-add-social"
          data-testid="card-add-service"
        >+ Aggiungi servizio</button>
      )}
    </div>
  );
}

// ─── CardSocialsFields ─────────────────────────────────────
export function CardSocialsFields({
  socials,
  updateSocial,
  addSocial,
  removeSocial,
}: CardSocialsState) {
  return (
    <div className="card-field">
      <span>Social (opzionali)</span>
      {socials.map((s, idx) => {
        const knownPlatform = SOCIAL_PLATFORMS.find((p) => p.value === s.platform);
        const isAltro = !knownPlatform;
        return (
          <div key={idx} className="card-social-row">
            <select
              value={knownPlatform ? knownPlatform.value : '__altro__'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__altro__') {
                  updateSocial(idx, 'platform', '__altro__');
                } else {
                  updateSocial(idx, 'platform', v);
                }
              }}
              aria-label={`Social ${idx + 1} piattaforma`}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p.value || 'empty'} value={p.value}>{p.label}</option>
              ))}
              <option value="__altro__">Altro</option>
            </select>
            {isAltro ? (
              <input
                type="text"
                value={s.platform === '__altro__' ? '' : s.platform}
                onChange={(e) => updateSocial(idx, 'platform', e.target.value || '__altro__')}
                placeholder="Nome piattaforma (es. Mastodon)"
                aria-label={`Altra piattaforma ${idx + 1}`}
              />
            ) : (
              <input
                type="text"
                value={s.url}
                onChange={(e) => updateSocial(idx, 'url', e.target.value)}
                placeholder="@username o URL"
                aria-label={`Social ${idx + 1} URL`}
              />
            )}
            <button type="button" onClick={() => removeSocial(idx)} aria-label={`Rimuovi social ${idx + 1}`}>×</button>
          </div>
        );
      })}
      <button type="button" onClick={addSocial} className="card-add-social" data-testid="card-add-social">+ Aggiungi social</button>
    </div>
  );
}

// ─── CardQrAdvanced (payload + label + qrSize) ─────────────
export function CardQrAdvanced({
  card,
  patchBack,
}: CardSectionProps) {
  return (
    <details className="card-advanced-qr" data-testid="qr-advanced-details">
      <summary>Opzioni QR avanzate</summary>
      <label className="card-field">
        <span>Payload QR (override manuale)</span>
        <input
          type="text"
          name="qrPayload"
          value={card.back.qrPayload}
          onChange={(e) => patchBack({ qrPayload: e.target.value })}
          placeholder="Lascia vuoto per usare il sito web"
          aria-label="Payload QR"
        />
      </label>
      <label className="card-field">
        <span>Etichetta sotto il QR</span>
        <input
          type="text"
          name="qrLabel"
          value={card.back.qrLabel}
          onChange={(e) => patchBack({ qrLabel: e.target.value })}
          placeholder="Es. Scansiona per visitare il sito"
          aria-label="Etichetta QR"
        />
      </label>
      <label className="card-field">
        <span>Dimensione QR (flexbox)</span>
        <select
          value={card.back.qrSize}
          onChange={(e) => patchBack({ qrSize: e.target.value as BusinessCardQrSize })}
          aria-label="Dimensione QR"
          data-testid="card-qr-size"
        >
          {Object.entries(QR_SIZE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
    </details>
  );
}

// ─── CardStyleFields (formato + bordo + colori + font + fontScale) ──
export function CardStyleFields({ card, patchStyle }: CardSectionProps) {
  const fontScale = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, card.style.fontScale ?? 1));
  return (
    <fieldset className="card-fieldset">
      <legend>Stile</legend>
      <div className="card-row-2">
        <label className="card-field">
          <span>Formato bigliettino</span>
          <select
            value={card.style.sizePreset}
            onChange={(e) => patchStyle({ sizePreset: e.target.value as BusinessCardSizePreset })}
            aria-label="Formato bigliettino"
          >
            {Object.entries(SIZE_PRESET_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="card-field">
          <span>Stile bordo</span>
          <select
            value={card.style.borderStyle}
            onChange={(e) => patchStyle({ borderStyle: e.target.value as BusinessCardBorderStyle })}
            aria-label="Stile bordo"
          >
            {Object.entries(BORDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="card-color-row">
        <label className="card-color-cell">
          <span>Sfondo</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.bgColor}
              onChange={(e) => patchStyle({ bgColor: e.target.value })}
              aria-label="Colore sfondo"
            />
            <code>{card.style.bgColor.toUpperCase()}</code>
          </div>
        </label>
        <label className="card-color-cell">
          <span>Testo</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.textColor}
              onChange={(e) => patchStyle({ textColor: e.target.value })}
              aria-label="Colore testo"
            />
            <code>{card.style.textColor.toUpperCase()}</code>
          </div>
        </label>
        <label className="card-color-cell">
          <span>Accento</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.accentColor}
              onChange={(e) => patchStyle({ accentColor: e.target.value })}
              aria-label="Colore accento"
            />
            <code>{card.style.accentColor.toUpperCase()}</code>
          </div>
        </label>
      </div>
      <AiFontPicker
        label="Font del bigliettino"
        value={card.style.fontFamily}
        onChange={(font) => patchStyle({ fontFamily: font })}
        aria-label="Font del bigliettino"
        data-testid="card-font-family"
      />
      <div className="card-field" data-testid="card-font-scale">
        <span>Dimensione testo ({Math.round(fontScale * 100)}%)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="card-preview-zoom-btn"
            onClick={() => patchStyle({ fontScale: Math.max(FONT_SCALE_MIN, Math.round((fontScale - FONT_SCALE_STEP) * 100) / 100) })}
            disabled={fontScale <= FONT_SCALE_MIN}
            aria-label="Diminuisci dimensione testo"
            title="Diminuisci dimensione testo"
          >−</button>
          <input
            type="range"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            value={fontScale}
            onChange={(e) => patchStyle({ fontScale: Number(e.target.value) })}
            aria-label="Dimensione testo"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="card-preview-zoom-btn"
            onClick={() => patchStyle({ fontScale: Math.min(FONT_SCALE_MAX, Math.round((fontScale + FONT_SCALE_STEP) * 100) / 100) })}
            disabled={fontScale >= FONT_SCALE_MAX}
            aria-label="Aumenta dimensione testo"
            title="Aumenta dimensione testo"
          >+</button>
          <button
            type="button"
            onClick={() => patchStyle({ fontScale: 1 })}
            className="card-ai-reset"
            aria-label="Reset dimensione testo"
            title="Reset (100%)"
          >Reset</button>
        </div>
      </div>
    </fieldset>
  );
}
