import type { PremiumQuote } from '../utils/quoteSchema';
import { recalculateQuote } from '../utils/quoteSchema';

export interface MergeResult {
  quote: PremiumQuote;
  changes: string[];
}

export interface MergeOptions {
  /**
   * When true, preserve numeric fields (discount, unitPrice, quantity, tax,
   * total) from the current quote, ignoring values from the AI response.
   * Used for the follow-up merge after tool execution, so the AI cannot
   * revert tool-applied changes (bug #2).
   */
  preserveNumeric?: boolean;
}

export function mergeAIResponse(
  currentQuote: PremiumQuote,
  modified: Record<string, unknown>,
  opts: MergeOptions = {},
): MergeResult {
  const updated = { ...currentQuote };
  const changes: string[] = [];

  if (modified.project && typeof modified.project === 'object') {
    const p = modified.project as Record<string, unknown>;
    if (p.title && p.title !== updated.project.title) {
      updated.project = { ...updated.project, title: p.title as string };
      changes.push(`Titolo progetto: "${p.title}"`);
    }
    if (p.description !== undefined && p.description !== updated.project.description) {
      updated.project = { ...updated.project, description: p.description as string };
      changes.push(`Descrizione progetto aggiornata`);
    }
    if (p.code !== undefined) {
      updated.project = { ...updated.project, code: p.code as string };
    }
  }

  if (modified.client && typeof modified.client === 'object') {
    const c = modified.client as Record<string, unknown>;
    if (c.name && c.name !== updated.client.name) {
      updated.client = { ...updated.client, name: c.name as string };
      changes.push(`Cliente: "${c.name}"`);
    }
    if (c.contactPerson !== undefined) {
      updated.client = { ...updated.client, contactPerson: c.contactPerson as string };
    }
    if (c.email !== undefined) {
      updated.client = { ...updated.client, email: c.email as string };
    }
    if (c.address !== undefined) {
      updated.client = { ...updated.client, address: c.address as string };
    }
    if (c.phone !== undefined) {
      updated.client = { ...updated.client, phone: c.phone as string };
    }
  }

  if (modified.issuer && typeof modified.issuer === 'object') {
    const i = modified.issuer as Record<string, unknown>;
    if (i.name) {
      updated.issuer = { ...updated.issuer, name: i.name as string };
      changes.push(`Emittente: "${i.name}"`);
    }
    if (i.email !== undefined) {
      updated.issuer = { ...updated.issuer, email: i.email as string };
    }
  }

  if (modified.options && Array.isArray(modified.options)) {
    const modOptions = modified.options as Record<string, unknown>[];
    let hasChanges = false;
    const modifiedOptionIds = new Set(modOptions.map((mo) => mo.id as string));

    // Opzioni rimosse
    for (const existingOpt of currentQuote.options) {
      if (!modifiedOptionIds.has(existingOpt.id)) {
        changes.push(`Opzione rimossa: "${existingOpt.label}"`);
        hasChanges = true;
      }
    }

    for (const mo of modOptions) {
      const existing = currentQuote.options.find((o) => o.id === mo.id);
      if (!existing) {
        changes.push(`Nuova opzione aggiunta`);
        hasChanges = true;
        continue;
      }

      if (mo.label && mo.label !== existing.label) {
        changes.push(`Opzione "${existing.label}": nome → "${mo.label}"`);
        hasChanges = true;
      }

      if (mo.description !== undefined && mo.description !== existing.description) {
        changes.push(`Opzione "${mo.label || existing.label}": descrizione aggiornata`);
        hasChanges = true;
      }

      if (mo.items && Array.isArray(mo.items)) {
        for (const mi of mo.items as Record<string, unknown>[]) {
          const existingItem = existing.items.find((ei) => ei.id === mi.id);
          if (!existingItem) {
            changes.push(`Opzione "${existing.label}": nuova voce "${(mi.label as string) || 'senza nome'}"`);
            hasChanges = true;
            continue;
          }
          if (mi.unitPrice !== undefined && Number(mi.unitPrice) !== existingItem.unitPrice) {
            changes.push(`${existing.label} → "${existingItem.label}": prezzo ${existingItem.unitPrice}€ → ${mi.unitPrice}€`);
            hasChanges = true;
          }
          if (mi.quantity !== undefined && Number(mi.quantity) !== existingItem.quantity) {
            changes.push(`${existing.label} → "${existingItem.label}": quantità ${existingItem.quantity} → ${mi.quantity}`);
            hasChanges = true;
          }
          if (mi.description !== undefined && mi.description !== existingItem.description) {
            changes.push(`Voce "${existingItem.label}": descrizione aggiornata`);
            hasChanges = true;
          }
          if (mi.label && mi.label !== existingItem.label) {
            changes.push(`Voce rinominata "${existingItem.label}" → "${mi.label}"`);
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      updated.options = modOptions.map((mo) => {
        const ex = currentQuote.options.find((o) => o.id === mo.id);
        if (ex) {
          return {
            ...ex,
            label: (mo.label as string) || ex.label,
            description: mo.description !== undefined ? (mo.description as string) : ex.description,
            items: mo.items
              ? (mo.items as Record<string, unknown>[]).map((mi) => {
                  const ei = ex.items.find((e) => e.id === mi.id);
                  if (!ei) {
                    return {
                      id: mi.id as string,
                      label: (mi.label as string) || 'senza nome',
                      description: (mi.description as string) || '',
                      category: (mi.category as any) || 'service',
                      unit: (mi.unit as any) || 'fixed',
                      quantity: typeof mi.quantity === 'number' ? mi.quantity : 1,
                      unitPrice: typeof mi.unitPrice === 'number' ? mi.unitPrice : 0,
                      discount: (mi.discount as any) || { type: 'none', value: 0 },
                      tax: (mi.tax as any) || { type: 'vat', rate: 22 },
                    } as any;
                  }
                  if (opts.preserveNumeric) {
                    return {
                      ...ei,
                      ...mi,
                      discount: ei.discount,
                      tax: ei.tax,
                      unitPrice: ei.unitPrice,
                      quantity: ei.quantity,
                      total: ei.total,
                    };
                  }
                  return {
                    ...ei,
                    ...mi,
                    discount: mi.discount || ei.discount,
                    tax: mi.tax || ei.tax,
                    total: ei.total,
                  };
                })
              : ex.items,
          };
        }
        return mo as any;
      });

      const recalculated = recalculateQuote({ ...currentQuote, options: updated.options });
      updated.options = recalculated.options;
      updated.globalTotals = recalculated.globalTotals;
    }
  }

  if (modified.legalClauses && Array.isArray(modified.legalClauses)) {
    const clauses = modified.legalClauses as Record<string, unknown>[];
    // Clausole rimosse
    const modifiedClauseIds = new Set(clauses.map((c) => c.id as string));
    for (const existingCl of currentQuote.legalClauses) {
      if (!modifiedClauseIds.has(existingCl.id)) {
        changes.push(`Clausola rimossa: "${existingCl.title}"`);
      }
    }

    for (const mc of clauses) {
      // Accept "content" as alias of "body" (AI often uses "content")
      const body = (mc.body ?? mc.content) as string | undefined;
      const existing = currentQuote.legalClauses.find((cl) => cl.id === mc.id);
      if (existing) {
        if (mc.title && mc.title !== existing.title) changes.push(`Clausola: titolo → "${mc.title}"`);
        if (body && body !== existing.body) changes.push(`Clausola "${existing.title || mc.title}": testo modificato`);
      } else {
        changes.push(`Nuova clausola: "${(mc.title as string) || 'senza titolo'}"`);
      }
    }
    updated.legalClauses = clauses.map((mc) => {
      const body = (mc.body ?? mc.content) as string | undefined;
      const normalized = body !== undefined ? { ...mc, body } : mc;
      const existing = currentQuote.legalClauses.find((cl) => cl.id === mc.id);
      return existing ? { ...existing, ...normalized } : (normalized as any);
    });
  }

  if (modified.paymentTerms && typeof modified.paymentTerms === 'object') {
    const pt = modified.paymentTerms as Record<string, unknown>;
    updated.paymentTerms = { ...updated.paymentTerms };
    if (pt.paymentMethod !== undefined) {
      updated.paymentTerms.paymentMethod = pt.paymentMethod as string;
      changes.push(`Metodo pagamento: ${pt.paymentMethod}`);
    }
    if (pt.paymentSchedule !== undefined) {
      updated.paymentTerms.paymentSchedule = pt.paymentSchedule as any;
      changes.push(`Scadenze pagamento aggiornate`);
    }
    if (pt.iban !== undefined) {
      updated.paymentTerms.iban = pt.iban as string;
      changes.push(`IBAN aggiornato`);
    }
    if (pt.bic !== undefined) {
      updated.paymentTerms.bic = pt.bic as string;
    }
  }

  if (modified.uiPreferences && typeof modified.uiPreferences === 'object') {
    const ui = modified.uiPreferences as Record<string, unknown>;
    updated.uiPreferences = { ...updated.uiPreferences };
    if (ui.accentColor && ui.accentColor !== currentQuote.uiPreferences.accentColor) {
      updated.uiPreferences.accentColor = ui.accentColor as string;
      changes.push(`Colore tema: ${ui.accentColor}`);
    }
    if (ui.templateId) updated.uiPreferences.templateId = ui.templateId as any;
    if (ui.fontFamily) updated.uiPreferences.fontFamily = ui.fontFamily as string;
    if (ui.showLogo !== undefined) updated.uiPreferences.showLogo = ui.showLogo as boolean;
    if (ui.showTotalsPerOption !== undefined) updated.uiPreferences.showTotalsPerOption = ui.showTotalsPerOption as boolean;
    if (ui.showGlobalTotals !== undefined) updated.uiPreferences.showGlobalTotals = ui.showGlobalTotals as boolean;
  }

  if (modified.notes !== undefined) {
    updated.notes = { ...updated.notes };
    if (typeof modified.notes === 'string') {
      // AI often sends notes as a plain string, treat as clientVisible
      updated.notes.clientVisible = modified.notes;
      changes.push('Note cliente modificate');
    } else {
      const n = modified.notes as Record<string, unknown>;
      if (n.internal !== undefined) {
        updated.notes.internal = n.internal as string;
        changes.push('Note interne modificate');
      }
      if (n.clientVisible !== undefined) {
        updated.notes.clientVisible = n.clientVisible as string;
        changes.push('Note cliente modificate');
      }
    }
  }

  if (modified.status) {
    updated.status = modified.status as any;
    changes.push(`Stato: ${modified.status}`);
  }
  if (modified.validUntil) {
    updated.validUntil = modified.validUntil as string;
    changes.push(`Valido fino al: ${modified.validUntil}`);
  }
  if (modified.currency) {
    updated.currency = modified.currency as string;
  }
  if (modified.locale) {
    updated.locale = modified.locale as string;
  }

  if (changes.length > 0) {
    updated.updatedAt = new Date().toISOString();
  }
  return { quote: updated, changes };
}
