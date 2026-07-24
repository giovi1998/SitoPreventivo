import type { CardSectionProps, BusinessCardQrSize } from './types';
import { QR_SIZE_LABELS } from './labels';

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
