import type { CardServicesState } from './types';

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
          onChange={(e) => patchBack?.({ servicesLabel: e.target.value })}
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
