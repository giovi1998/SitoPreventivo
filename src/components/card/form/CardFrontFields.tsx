import type { CardSectionProps, BusinessCardLayout } from './types';
import { LAYOUT_LABELS } from './labels';

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
