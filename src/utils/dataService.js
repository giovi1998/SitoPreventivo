// Facade dataService: stesso default export object del monolite originale,
// stessi nomi/firme dei metodi. I domini vivono in src/utils/dataService/*.js
// (solo .js, import relativi con estensione esplicita — gotcha §23: mai
// import .ts da qui, alcuni test fanno require() CJS). Zero logica qui:
// solo composizione. Vincoli comportamentali chiave preservati nei moduli:
// storage locale canonico FLAT per logo/card/flyer (§23), shim getCustomer
// `{...d, data: d}`, QR con `data` legittimo, compressione immagini pre-save
// (§2.12), detection IS_LOCAL singleton in dataService/core.js.
import { createAuthMethods } from './dataService/auth.js';
import { createDocumentsMethods } from './dataService/documents.js';
import { createSettingsMethods } from './dataService/settings.js';
import { createAiMethods } from './dataService/ai.js';
import { createCrmMethods } from './dataService/crm.js';

/** @type {any} */
const dataService = {};

// `svc` passato a ogni factory è lo stesso oggetto facade: i riferimenti
// cross-modulo (es. saveDocument → incrementDocumentCount) sono risolti a
// call time, come i riferimenti a `dataService` nel monolite originale.
Object.assign(
  dataService,
  createAuthMethods(dataService),
  createDocumentsMethods(dataService),
  createSettingsMethods(dataService),
  createAiMethods(dataService),
  createCrmMethods(dataService),
);

/** @typedef {ReturnType<typeof createAuthMethods> & ReturnType<typeof createDocumentsMethods> & ReturnType<typeof createSettingsMethods> & ReturnType<typeof createAiMethods> & ReturnType<typeof createCrmMethods>} DataService */

// Cast al tipo composto dei metodi: i consumer .ts/.tsx vedono le firme
// inferite dai moduli (come le inferivano dal monolite originale).
export default /** @type {DataService} */ (dataService);
