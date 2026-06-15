export const TWEAK_DEFAULTS = {
  accentColor: "#0B57D0",
  sidebarInk: "#082033",
  canvasWarmth: "#F6F8FC",
  documentScale: 0.92,
  density: 1
};

export const COLORS = [
  { name: "Blu Professionale", value: "#0B57D0" },
  { name: "Verde Smeraldo", value: "#10B981" },
  { name: "Viola Premium", value: "#7C3AED" },
  { name: "Arancio Caldo", value: "#F59E0B" },
  { name: "Rosso Elegante", value: "#EF4444" },
  { name: "Rosa Chic", value: "#EC4899" },
  { name: "Teal Moderno", value: "#14B8A6" },
  { name: "Grigio Minimal", value: "#4B5563" },
  { name: "Indigo Classico", value: "#6366F1" },
  { name: "Lime Energetico", value: "#84CC16" }
];

export const STYLES = [
  { id: "standard", name: "Standard (Moderno)" },
  { id: "classic", name: "Classico Formale" },
  { id: "minimal", name: "Minimal Studio" },
  { id: "editorial", name: "Editoriale" },
  { id: "compact", name: "Compatto" },
  { id: "tech", name: "Tech Lineare" },
  { id: "bold", name: "Bold Contrasto" },
  { id: "soft", name: "Morbido" },
  { id: "warm", name: "Toni Caldi" },
  { id: "vintage", name: "Vintage" }
];

export const initialItems = [
  { id: 1, description: "Progettazione struttura e wireframe", detail: "Mappa sezioni, architettura contenuti e bozza visiva navigabile.", qty: 1, rate: 280 },
  { id: 2, description: "Sviluppo sito responsive", detail: "Implementazione one-page con sezioni servizi, chi siamo, contatti e mappa.", qty: 1, rate: 490 },
  { id: 3, description: "SEO tecnica e privacy", detail: "Meta tag, performance base, cookie banner e pagine privacy essenziali.", qty: 1, rate: 190 }
];

export const sectionLibrary = ["Introduzione progetto", "Piani e pacchetti", "Materiali richiesti", "Condizioni", "Firme", "FAQ cliente"];
export const templates = ["standard", "autore"];

export const quotes = [
  { id: "PRV-2026-041", title: "Sito web studio legale", client: "Studio Legale Rossi & Associati", status: "Bozza", date: "26 mag 2026", total: 1171.20, owner: "Giovanni Cidu", items: initialItems, sections: ["Introduzione progetto", "Piani e pacchetti", "Condizioni"], vat: 22, template: "standard", color: "#0B57D0", styleId: "standard" },
  { id: "PRV-2026-038", title: "Restyling ristorante", client: "Trattoria Porta Nuova", status: "Inviato", date: "18 mag 2026", total: 1842.20, owner: "Giovanni Cidu", items: initialItems, sections: ["Introduzione progetto", "Piani e pacchetti", "Materiali richiesti", "Condizioni"], vat: 22, template: "standard", color: "#14B8A6", styleId: "compact" },
  { id: "PRV-2026-032", title: "Landing evento wellness", client: "Alba Retreat", status: "Accettato", date: "03 mag 2026", total: 927.20, owner: "Giovanni Cidu", items: initialItems, sections: ["Introduzione progetto", "Materiali richiesti", "Condizioni"], vat: 22, template: "standard", color: "#7C3AED", styleId: "minimal" }
];

export const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

