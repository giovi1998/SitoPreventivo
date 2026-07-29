// TB-019: mapping brief intake → document draft data.
// Shape allineate a createEmpty*() factories (documentSchemas.ts).
// ponytail: riusiamo factories come base, sovrascriviamo campi brief.

import { createEmptyCard, createEmptyLogo, createEmptyFlyer } from './documentSchemas';

export interface IntakeBrief {
  businessName: string;
  ownerName?: string | null;
  sector?: string | null;
  activity?: string | null;
  mood?: string | null;
  target?: string | null;
  preferredColors?: string | null;
  contacts?: Record<string, unknown> | null;
  package?: string | null;
}

export interface IntakeDocumentDraft {
  documentType: 'logo' | 'businessCard' | 'flyer' | 'generatedImage';
  title: string;
  data: Record<string, unknown>;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function intakeToLogo(brief: IntakeBrief): IntakeDocumentDraft {
  const base = createEmptyLogo();
  return {
    documentType: 'logo',
    title: `Logo ${brief.businessName}`,
    data: {
      ...base,
      title: `Logo ${brief.businessName}`,
      builder: {
        ...base.builder,
        primaryText: brief.businessName,
        tagline: asString(brief.activity),
        iconType: 'lucide',
        iconGlyph: 'sparkles',
      },
      brief: asString(brief.activity),
      briefContext: buildBriefContextFromIntake(brief),
    },
  };
}

export function intakeToCard(brief: IntakeBrief): IntakeDocumentDraft {
  const base = createEmptyCard();
  const contacts = (brief.contacts || {}) as Record<string, unknown>;
  return {
    documentType: 'businessCard',
    title: `Card ${brief.businessName}`,
    data: {
      ...base,
      title: `Card ${brief.businessName}`,
      front: {
        ...base.front,
        name: asString(brief.ownerName),
        title: asString(brief.sector),
        company: brief.businessName,
      },
      back: {
        ...base.back,
        phone: asString(contacts.phone),
        email: asString(contacts.email),
        website: asString(contacts.website),
        address: asString(contacts.address),
      },
      briefContext: buildBriefContextFromIntake(brief),
    },
  };
}

export function intakeToFlyer(brief: IntakeBrief): IntakeDocumentDraft {
  const base = createEmptyFlyer();
  return {
    documentType: 'flyer',
    title: `Flyer ${brief.businessName}`,
    data: {
      ...base,
      title: `Flyer ${brief.businessName}`,
      content: {
        ...base.content,
        headline: brief.businessName,
        subheadline: asString(brief.activity),
        body: asString(brief.activity),
      },
      briefContext: buildBriefContextFromIntake(brief),
    },
  };
}

export function intakeToSocial(brief: IntakeBrief): IntakeDocumentDraft {
  return {
    documentType: 'generatedImage',
    title: `Social ${brief.businessName}`,
    data: {
      caption: `${brief.businessName} — ${asString(brief.activity)}`,
      brandName: brief.businessName,
      sector: asString(brief.sector) || 'generico',
      mood: asString(brief.mood) || 'moderno',
      style: { accentColor: '#01696F' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function intakeToAllDocuments(brief: IntakeBrief): IntakeDocumentDraft[] {
  // TB-027: solo logo, card, flyer (no social in v1)
  return [
    intakeToLogo(brief),
    intakeToCard(brief),
    intakeToFlyer(brief),
  ];
}

// TB-027: brief context string per AI
export function buildBriefContextFromIntake(brief: IntakeBrief): string {
  const parts: string[] = [];
  if (brief.businessName) parts.push(`Attività: ${brief.businessName}`);
  if (brief.ownerName) parts.push(`Referente: ${brief.ownerName}`);
  if (brief.sector) parts.push(`Settore: ${brief.sector}`);
  if (brief.activity) parts.push(`Descrizione: ${brief.activity}`);
  if (brief.mood) parts.push(`Mood: ${brief.mood}`);
  if (brief.target) parts.push(`Target: ${brief.target}`);
  if (brief.preferredColors) parts.push(`Palette: ${brief.preferredColors}`);
  const c = brief.contacts || {};
  if (c.address) parts.push(`Indirizzo: ${c.address}`);
  if (c.website) parts.push(`Sito: ${c.website}`);
  if (c.phone) parts.push(`Telefono: ${c.phone}`);
  if (c.email) parts.push(`Email: ${c.email}`);
  return parts.join('\n');
}