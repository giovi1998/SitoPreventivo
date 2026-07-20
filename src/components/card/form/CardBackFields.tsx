import type { CardSectionProps } from './types';

export function CardBackFields({ card, patchBack }: CardSectionProps) {
  return (
    <fieldset className="card-fieldset">
      <legend>Retro</legend>
      <label className="card-field">
        <span>Telefono</span>
        <input
          type="tel"
          value={card.back.phone}
          onChange={(e) => patchBack({ phone: e.target.value })}
          aria-label="Telefono"
        />
      </label>
      <label className="card-field">
        <span>Email</span>
        <input
          type="email"
          value={card.back.email}
          onChange={(e) => patchBack({ email: e.target.value })}
          aria-label="Email"
        />
      </label>
      <label className="card-field">
        <span>Sito web</span>
        <input
          type="url"
          value={card.back.website}
          onChange={(e) => patchBack({ website: e.target.value })}
          aria-label="Sito web"
        />
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
        <span>Partita IVA / Codice fiscale</span>
        <input
          type="text"
          value={card.back.vatNumber}
          onChange={(e) => patchBack({ vatNumber: e.target.value })}
          aria-label="Partita IVA"
        />
      </label>
    </fieldset>
  );
}
