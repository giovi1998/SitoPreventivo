import { createEmptyFlyer } from '../../documentSchemas';
import type { Flyer } from '../../documentSchemas';

/**
 * Stress fixtures: flyers with intentionally oversized copy for a given
 * format/layout. These are used to verify that the layout engine detects
 * overflow and emits warnings instead of producing overlapping elements.
 */
export function stressLongHeadline(size: Flyer['size'], orientation: Flyer['orientation'] = 'portrait', layout: Flyer['style']['layout'] = 'classic'): Flyer {
  const base = createEmptyFlyer();
  return {
    ...base,
    size,
    orientation,
    style: { ...base.style, layout },
    content: {
      ...base.content,
      headline: 'Cena di Degustazione Speciale con Menu Stellato',
      subheadline: 'Venerdì 15 agosto · ore 20:30 · via Roma 123, Cagliari',
      body: 'Menu di 5 portate dello chef Marco Bianchi, in abbinamento a 3 vini del territorio selezionati dal sommelier Anna Verdi. Posti limitati, prenotazione obbligatoria entro mercoledì 13 agosto. Coperto 45€, bevande escluse.',
      cta: { label: 'Prenota il tuo tavolo ora', url: 'https://example.com' },
      qrPayload: 'https://example.com',
      qrLabel: 'Scansiona per il menù completo',
    },
  };
}

export function stressOverflowBody(size: Flyer['size'], orientation: Flyer['orientation'] = 'portrait', layout: Flyer['style']['layout'] = 'classic'): Flyer {
  const base = createEmptyFlyer();
  const paragraphs = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
    'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.',
    'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
    'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.',
    'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.',
    'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
    'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores.',
    'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.',
    'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.',
    'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.',
    'Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus.',
  ];
  return {
    ...base,
    size,
    orientation,
    style: { ...base.style, layout },
    content: {
      ...base.content,
      headline: 'Evento',
      subheadline: '15 agosto',
      heroImage: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2NjYyIvPjwvc3ZnPg==',
      body: paragraphs.join('\n\n'),
      cta: { label: 'Prenota', url: 'https://example.com' },
      qrPayload: 'https://example.com',
      qrLabel: 'Scansiona per maggiori informazioni',
    },
  };
}

export function stressWideCta(size: Flyer['size'], orientation: Flyer['orientation'] = 'portrait', layout: Flyer['style']['layout'] = 'classic'): Flyer {
  const base = createEmptyFlyer();
  return {
    ...base,
    size,
    orientation,
    style: { ...base.style, layout },
    content: {
      ...base.content,
      headline: 'Offerta',
      subheadline: 'Solo oggi',
      body: 'Dettagli promozione.',
      cta: { label: 'Prenota il tuo tavolo subito', url: 'https://example.com' },
      qrPayload: 'https://example.com',
      qrLabel: 'Scansiona per maggiori informazioni',
    },
  };
}

export function stressTinyFormat(): Flyer {
  return stressLongHeadline('A6', 'portrait', 'classic');
}

export function stressMagazineManyColumns(): Flyer {
  return stressOverflowBody('A4', 'portrait', 'magazine');
}

export function stressLandscapeSplit(): Flyer {
  return stressLongHeadline('A4', 'landscape', 'split');
}
