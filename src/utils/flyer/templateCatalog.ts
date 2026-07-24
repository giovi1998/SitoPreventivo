import type { FlyerSize, FlyerOrientation, FlyerLayout, FlyerSector } from '../documentSchemas';

export interface FlyerTemplatePreset {
  title: string;
  size: FlyerSize;
  orientation: FlyerOrientation;
  layout: FlyerLayout;
  bgColor: string;
  textColor: string;
  accentColor: string;
  imageSeed: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: { label: string; url: string };
  qrLabel: string;
}

export const FLYER_SECTOR_DEFAULT_LAYOUT: Record<FlyerSector, FlyerLayout> = {
  ristorante: 'classic',
  evento: 'centered',
  salone: 'split',
  negozio: 'magazine',
};

export const FLYER_TEMPLATES_BY_SECTOR_LAYOUT: Record<FlyerSector, Record<FlyerLayout, FlyerTemplatePreset>> = {
  ristorante: {
    classic: {
      title: 'Cena di Degustazione · Trattoria del Borgo',
      size: 'A5', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-classic',
      headline: 'Cena di Degustazione',
      subheadline: 'Venerdì 15 agosto · ore 20:30',
      body: 'Menu di 5 portate dello chef Marco Bianchi, in abbinamento a 3 vini del territorio selezionati dal sommelier Anna Verdi.\n\nPosti limitati, prenotazione obbligatoria entro mercoledì 13 agosto.',
      cta: { label: 'Prenota un Tavolo', url: 'https://trattoriadelborgo.it/menu' },
      qrLabel: 'Scansiona per il menù completo',
    },
    centered: {
      title: 'Sapori d\'Autunno · Trattoria del Borgo',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-centered',
      headline: 'Sapori d\'Autunno',
      subheadline: 'Nuova stagione, nuovi piatti',
      body: 'Dal 1 ottobre 4 nuovi piatti firmati dalla chef Anna Rossi: zucca, tartufo, castagne e funghi porcini.\n\nPrenota il tavolo per la serata di apertura, drink di benvenuto offerto.',
      cta: { label: 'Scopri il Menù', url: 'https://trattoriadelborgo.it/autunno' },
      qrLabel: 'Prenota online',
    },
    split: {
      title: 'Trattoria del Borgo · Cucina di stagione',
      size: 'A4', orientation: 'portrait', layout: 'split',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-split',
      headline: 'Trattoria del Borgo',
      subheadline: 'Cucina di stagione, ingredienti locali',
      body: 'Piatti della tradizione sarda rivisitati con materie prime a km 0.\n\nAperti a pranzo e cena, chiusi il lunedì. Via Roma 12, Cagliari.',
      cta: { label: 'Vieni a Trovarci', url: 'https://maps.example.com/trattoria-borgo' },
      qrLabel: 'Scansiona per la mappa',
    },
    magazine: {
      title: 'Menù della Settimana · Trattoria del Borgo',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309',
      imageSeed: 'ristorante-magazine',
      headline: 'Menù della Settimana',
      subheadline: 'Dal 10 al 16 agosto',
      body: 'Lunedì: tagliatelle al ragù bianco.\nMartedì: risotto allo zafferano.\nMercoledì: tagliata di manzo con rucola.',
      cta: { label: 'Prenota', url: 'https://trattoriadelborgo.it/prenota' },
      qrLabel: 'Menù completo online',
    },
  },
  evento: {
    classic: {
      title: 'Sagra di Paese 2026',
      size: 'A4', orientation: 'landscape', layout: 'classic',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-classic',
      headline: 'Sagra di Paese 2026',
      subheadline: '15, 16, 17 agosto · Piazza del Popolo',
      body: 'Tre serate di festa con cucina tipica, musica dal vivo e balli sardi.\n\nIngresso gratuito, stand gastronomici dalle 19:00.',
      cta: { label: 'Scopri il Programma', url: 'https://sagrapaese2026.it/programma' },
      qrLabel: 'Programma completo online',
    },
    centered: {
      title: 'Festa di San Giovanni',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-centered',
      headline: 'Festa di San Giovanni',
      subheadline: '24 giugno · Centro Storico',
      body: 'Fiaccolata, concerto della banda cittadina e gran finale con fuochi d\'artificio a mezzanotte.\n\nApertura stand gastronomici ore 19:30.',
      cta: { label: 'Guarda il Programma', url: 'https://sangiovanni.it/programma' },
      qrLabel: 'Mappa della festa',
    },
    split: {
      title: 'Notte Bianca · Centro Città',
      size: 'A4', orientation: 'landscape', layout: 'split',
      bgColor: '#0F172A', textColor: '#F8FAFC', accentColor: '#F59E0B',
      imageSeed: 'evento-split',
      headline: 'Notte Bianca',
      subheadline: 'Sabato 5 luglio · Centro Città',
      body: 'Negozi aperti fino a mezzanotte, musica in 5 piazze e dj set finale alle 23:30.\n\nIngresso libero, parcheggio gratuito.',
      cta: { label: 'Vedi la Mappa', url: 'https://nottebianca.it/mappa' },
      qrLabel: 'Mappa dei punti',
    },
    magazine: {
      title: 'Programma del Week-End',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFFFFF', textColor: '#0F172A', accentColor: '#0F766E',
      imageSeed: 'evento-magazine',
      headline: 'Programma del Week-End',
      subheadline: '5, 6, 7 luglio',
      body: 'Venerdì: Notte Bianca e negozi aperti.\nSabato: Mercatino artigianale e concerto jazz.\nDomenica: Spettacolo per bambini e cinema sotto le stelle.',
      cta: { label: 'Vedi gli Orari', url: 'https://weekendcitta.it/orari' },
      qrLabel: 'Orari completi online',
    },
  },
  salone: {
    classic: {
      title: 'Salone Bellezza · Promo Estate',
      size: 'A6', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: 'salone-classic',
      headline: 'Promo Estate -20%',
      subheadline: 'Valido fino al 30 agosto',
      body: 'Taglio, piega e colore a prezzo speciale per tutta l\'estate.\n\nPrenota il tuo appuntamento con i nostri stilisti.',
      cta: { label: 'Prenota Ora', url: 'https://salonebellezza.it/promo-estate' },
      qrLabel: 'Prenota online',
    },
    centered: {
      title: 'Nuova Apertura · Salone Centro',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: 'salone-centered',
      headline: 'Nuova Apertura',
      subheadline: '15 settembre · Salone Centro',
      body: 'Apre il nuovo spazio in centro: 200mq dedicati a taglio, colore e trattamenti.\n\nPrenota la visita gratuita con consulenza.',
      cta: { label: 'Prenota Visita', url: 'https://salonecentro.it/apertura' },
      qrLabel: 'Prenota online',
    },
    split: {
      title: 'Salone Bellezza · Promo Weekend',
      size: 'A6', orientation: 'landscape', layout: 'split',
      bgColor: '#0F172A', textColor: '#F8FAFC', accentColor: '#E11D48',
      imageSeed: 'salone-split',
      headline: 'Saldi -20%',
      subheadline: 'Solo questo weekend',
      body: 'Taglio + piega + colore a 45€ invece di 56€.\nSu prenotazione, posti limitati.',
      cta: { label: 'Prenota', url: 'https://salonebellezza.it/weekend' },
      qrLabel: 'Prenota online',
    },
    magazine: {
      title: 'I Nostri Servizi · Salone Bellezza',
      size: 'A4', orientation: 'portrait', layout: 'magazine',
      bgColor: '#FFF1F2', textColor: '#1F2937', accentColor: '#E11D48',
      imageSeed: 'salone-magazine',
      headline: 'I Nostri Servizi',
      subheadline: 'Dal 2010 a Cagliari',
      body: 'Taglio & Piega: classico, moderno, sposa, bambino.\nColore: balayage, meches, tinta.\nTrattamenti: cheratina, impacco, anticrespo.',
      cta: { label: 'Prenota', url: 'https://salonebellezza.it/servizi' },
      qrLabel: 'Lista prezzi completa',
    },
  },
  negozio: {
    classic: {
      title: 'Boutique · Saldi di Stagione',
      size: 'A6', orientation: 'portrait', layout: 'classic',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-classic',
      headline: 'Saldi di Stagione',
      subheadline: 'Fino al -50% · 1-30 del mese',
      body: 'Migliaia di articoli scontati: abbigliamento, calzature e accessori.\n\nSpedizione gratuita sopra i 50€.',
      cta: { label: 'Vedi il Catalogo', url: 'https://boutique.example.com/saldi' },
      qrLabel: 'Scansiona per il catalogo',
    },
    centered: {
      title: 'Apertura Nuovo Store',
      size: 'A5', orientation: 'portrait', layout: 'centered',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-centered',
      headline: 'Apertura Nuovo Store',
      subheadline: 'Via Roma 23 · 20 settembre ore 18:00',
      body: 'Apre il nuovo punto vendita: 300mq di collezione autunno/inverno.\n\nSconto 10% all\'inaugurazione.',
      cta: { label: 'Vieni all\'Apertura', url: 'https://boutique.example.com/apertura' },
      qrLabel: 'Mappa e orari',
    },
    split: {
      title: 'Boutique · Outlet -50%',
      size: 'A4', orientation: 'portrait', layout: 'split',
      bgColor: '#FFFFFF', textColor: '#111827', accentColor: '#7C3AED',
      imageSeed: 'negozio-split',
      headline: 'Outlet -50%',
      subheadline: 'Collezione primavera/estate',
      body: 'Migliaia di capi a metà prezzo: t-shirt, camicie, jeans, gonne e accessori.\n\nSolo questa settimana, fino ad esaurimento.',
      cta: { label: 'Vedi l\'Outlet', url: 'https://boutique.example.com/outlet' },
      qrLabel: 'Lista outlet online',
    },
    magazine: {
      title: 'Le Nostre Categorie · Boutique',
      size: 'Square', orientation: 'portrait', layout: 'magazine',
      bgColor: '#111827', textColor: '#F8FAFC', accentColor: '#7C3AED',
      imageSeed: 'negozio-magazine',
      headline: 'Le Nostre Categorie',
      subheadline: 'Boutique · Autunno/Inverno 2026',
      body: 'Donna: abiti, gonne, top, maglioni e giacche.\nUomo: camicie, polo, felpe e pantaloni.\nBambino: magliette, felpe, jeans e gonne.',
      cta: { label: 'Vedi il Catalogo', url: 'https://boutique.example.com/categorie' },
      qrLabel: 'Catalogo online',
    },
  },
};

export function heroBoxMmForLayout(layout: FlyerLayout, dims: { w: number; h: number }): { w: number; h: number } {
  const cw = Math.max(20, dims.w - 10);
  const ch = Math.max(20, dims.h - 10);
  const gap = 3;
  switch (layout) {
    case 'split':
      return dims.w >= dims.h ? { w: cw * 0.5 - gap / 2, h: ch } : { w: cw, h: ch * 0.5 - gap / 2 };
    case 'centered':
      return { w: cw * 0.5, h: ch * 0.16 };
    case 'magazine':
      return { w: cw, h: ch * 0.25 };
    case 'classic':
    default:
      return { w: cw, h: ch * 0.42 };
  }
}
