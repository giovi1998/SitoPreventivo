import type { ToolDefinition } from '../types';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'apply_discount',
      description: 'Applica uno sconto percentuale o assoluto su tutte le opzioni, una singola opzione o un singolo item',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['percentage', 'absolute'],
            description: 'Tipo di sconto: percentage (es. 10%), absolute (es. 100€)',
          },
          value: {
            type: 'number',
            description: 'Valore dello sconto. Es: 10 per 10% se type=percentage, 100 per 100€ se type=absolute',
          },
          scope: {
            type: 'string',
            enum: ['all', 'option', 'item'],
            description: 'A cosa applicare lo sconto: all (tutto), option (una opzione), item (un singolo item)',
          },
          targetId: {
            type: 'string',
            description: 'ID dell\'opzione o dell\'item (richiesto se scope non è "all")',
          },
        },
        required: ['type', 'value', 'scope'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_margin',
      description: 'Ricalcola i prezzi unitari per ottenere un margine target percentuale su tutte le opzioni',
      parameters: {
        type: 'object',
        properties: {
          targetMarginPercent: {
            type: 'number',
            description: 'Margine target in percentuale (es. 30 per 30%)',
          },
        },
        required: ['targetMarginPercent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'duplicate_option',
      description: 'Duplica un\'opzione commerciale esistente',
      parameters: {
        type: 'object',
        properties: {
          optionId: {
            type: 'string',
            description: 'ID dell\'opzione da duplicare',
          },
        },
        required: ['optionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'split_quote',
      description: 'Mantiene solo le opzioni specificate, rimuovendo tutte le altre dal preventivo',
      parameters: {
        type: 'object',
        properties: {
          optionIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array di ID delle opzioni da mantenere (almeno uno)',
          },
        },
        required: ['optionIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'merge_options',
      description: 'Unisce due o più opzioni in una sola opzione con tutti gli items combinati',
      parameters: {
        type: 'object',
        properties: {
          optionIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array di ID delle opzioni da unire (almeno 2)',
          },
        },
        required: ['optionIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recalculate_totals',
      description: 'Ricalcola tutti i totali (netto, IVA, lordo) per ogni opzione e per il preventivo globale',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorder_options',
      description: 'Riordina le opzioni per prezzo o per nome',
      parameters: {
        type: 'object',
        properties: {
          sortBy: {
            type: 'string',
            enum: ['price_asc', 'price_desc', 'name'],
            description: 'Criterio di ordinamento',
          },
        },
        required: ['sortBy'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_empty_items',
      description: 'Elimina tutte le voci di costo con quantità o prezzo pari a zero',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'merge_duplicate_items',
      description: 'Unisce le voci di costo duplicate all\'interno di ogni opzione (stesso nome, stessa unità, stesso prezzo)',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'round_prices',
      description: 'Arrotonda i prezzi unitari al multiplo più vicino di un valore specificato',
      parameters: {
        type: 'object',
        properties: {
          nearest: {
            type: 'number',
            description: 'Arrotonda al multiplo di questo valore (es. 5 per .00/.05/.10, 10 per .00/.10/.20)',
          },
        },
        required: ['nearest'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_annual_cost',
      description: 'Aggiunge una riga con il costo annuale (12 mesi) per ogni voce mensile presente',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_consistency',
      description: 'Verifica che tutti i totali siano coerenti e li ricalcola se necessario',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'card_apply_palette',
      description: 'Applica una palette predefinita coerente (colori bgColor/textColor/accentColor) al bigliettino',
      parameters: {
        type: 'object',
        properties: {
          palette: {
            type: 'string',
            enum: ['premium', 'minimal', 'moderno', 'classico'],
            description: 'Palette da applicare',
          },
        },
        required: ['palette'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'card_switch_layout',
      description: 'Cambia il layout frontale del bigliettino (centered/left/split/right/top/bottom/minimal/photo-circle/compact)',
      parameters: {
        type: 'object',
        properties: {
          layout: {
            type: 'string',
            enum: ['centered', 'left', 'split', 'right', 'top', 'bottom', 'minimal', 'photo-circle', 'compact'],
            description: 'Layout da applicare',
          },
        },
        required: ['layout'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'card_add_service',
      description: 'Aggiunge un servizio alla lista back.services (max 8 servizi, ogni servizio max 80 caratteri)',
      parameters: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Testo del servizio (max 80 caratteri)',
          },
        },
        required: ['service'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'card_remove_empty_socials',
      description: 'Rimuove i social con url vuoto o placeholder "XXXXX"',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flyer_shorten_body',
      description: 'Tronca il body del volantino a una frazione del testo originale, rispettando il bodyCharBudget',
      parameters: {
        type: 'object',
        properties: {
          ratio: {
            type: 'number',
            minimum: 0.3,
            maximum: 0.8,
            description: 'Frazione del body da mantenere (0.3 = 30%, 0.8 = 80%)',
          },
        },
        required: ['ratio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flyer_change_tone',
      description: 'Riformula body e cta.label nel tono indicato (formale/ giovanile/ tecnico)',
      parameters: {
        type: 'object',
        properties: {
          tone: {
            type: 'string',
            enum: ['formale', 'giovanile', 'tecnico'],
            description: 'Tono da applicare',
          },
        },
        required: ['tone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flyer_add_urgency',
      description: 'Aggiunge una frase di urgenza al body del volantino (max 50 caratteri)',
      parameters: {
        type: 'object',
        properties: {
          phrase: {
            type: 'string',
            description: 'Frase di urgenza (max 50 caratteri, es. "Solo oggi")',
          },
        },
        required: ['phrase'],
      },
    },
  },
];

export function getToolNames(): string[] {
  return TOOL_DEFINITIONS.map((t) => t.function.name);
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.function.name === name);
}
