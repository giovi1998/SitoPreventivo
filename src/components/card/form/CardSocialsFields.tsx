import type { CardSocialsState } from './types';
import { SOCIAL_PLATFORMS } from './labels';

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
