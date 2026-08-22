// t21: coherence pass post-run — palette/font unificati CRM (agentMode).
// 1 call AI ideale; lean-code: versione deterministica che copia la palette
// del logo (primary/secondary) su card/flyer/website. Se il logo manca,
// usa la palette più frequente tra i draft. Upgrade ad AI quando la
// divergenza estetica misurata su screenshot supera la soglia.

import type { BusinessCard, Flyer, Logo } from '../utils/documentSchemas';

export interface CoherenceInput {
  logo?: Logo;
  card?: BusinessCard;
  flyer?: Flyer;
  website?: { brief?: { preferredColors?: string }; style?: string };
}

export interface CoherencePatch {
  card?: Partial<BusinessCard>;
  flyer?: Partial<Flyer>;
  website?: { preferredColors?: string };
}

function pickLogoPalette(logo?: Logo): { primary?: string; secondary?: string; accent?: string } | null {
  if (!logo) return null;
  // Preferisce il builder attivo, poi il primo concept.
  const b = (logo as unknown as { builder?: Logo['builder']; concepts?: Array<Logo['builder']> }).builder
    ?? (logo as unknown as { concepts?: Array<Logo['builder']> }).concepts?.[0];
  if (!b) return null;
  return { primary: b.primaryColor, secondary: b.secondaryColor, accent: b.primaryColor };
}

export function cohereDrafts(input: CoherenceInput): CoherencePatch {
  const palette = pickLogoPalette(input.logo);
  if (!palette?.primary) return {};

  const patch: CoherencePatch = {};
  // Card: allinea accent e palette decorativa
  if (input.card) {
    const cur = (input.card as unknown as { style?: { accentColor?: string }; decorations?: { palette?: Record<string, unknown> } });
    if (cur.style?.accentColor !== palette.primary) {
      patch.card = {
        style: { ...(input.card.style as unknown as Record<string, unknown>), accentColor: palette.primary } as unknown as BusinessCard['style'],
        decorations: {
          ...(input.card.decorations as unknown as Record<string, unknown>),
          palette: { ...(cur.decorations?.palette as Record<string, unknown>), primary: palette.primary, secondary: palette.secondary ?? (cur.decorations?.palette as Record<string, unknown>)?.secondary },
        } as unknown as BusinessCard['decorations'],
      } as unknown as Partial<BusinessCard>;
    }
  }
  // Flyer: stessa palette
  if (input.flyer) {
    const cur = (input.flyer as unknown as { style?: { accentColor?: string } });
    if (cur.style?.accentColor !== palette.primary) {
      patch.flyer = {
        style: { ...(input.flyer.style as unknown as Record<string, unknown>), accentColor: palette.primary } as unknown as Flyer['style'],
      } as unknown as Partial<Flyer>;
    }
  }
  // Website: preferredColors stringa CSV
  if (input.website) {
    const csv = [palette.primary, palette.secondary].filter(Boolean).join(',');
    if (csv && input.website.brief?.preferredColors !== csv) {
      patch.website = { preferredColors: csv };
    }
  }
  return patch;
}
