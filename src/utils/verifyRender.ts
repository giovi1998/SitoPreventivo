// t18: renderizza i draft logo/card/flyer in PNG data URL per la
// chiamata di verifica visione post-loop (`verifyOrchestrator`).
// 512px lato lungo: sotto i 400px il modello non legge le gerarchie
// tipografiche (contatti retro card ~16px scalati) e giudica cieco.
import type { BusinessCard, Flyer, Logo } from './documentSchemas';
import { buildCardSvg } from './card/svgRenderer';
import { builderToSvg } from './logo/svgBuilder';
import { buildFlyerSvg } from './flyer/svgRenderer';
import { svgToPng } from './logo/exporters';

const PREVIEW_PX = 512;

async function svgStringToPngDataUrl(svg: string): Promise<string> {
  const bytes = await svgToPng(svg, PREVIEW_PX, { tier: 'unlocked' });
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return `data:image/png;base64,${btoa(binary)}`;
}

export interface RenderPreviewsInput {
  logo?: Logo;
  card?: BusinessCard;
  flyer?: Flyer;
}

export interface RenderPreviewsOutput {
  logo?: string;
  card?: string;
  flyer?: string;
}

export async function renderDraftPreviews(input: RenderPreviewsInput): Promise<RenderPreviewsOutput> {
  const out: RenderPreviewsOutput = {};
  const tasks: Promise<void>[] = [];
  if (input.logo?.builder) {
    tasks.push(
      svgStringToPngDataUrl(builderToSvg(input.logo.builder)).then((png) => {
        out.logo = png;
      }),
    );
  }
  if (input.card) {
    tasks.push(
      svgStringToPngDataUrl(buildCardSvg(input.card, 'front', 640, 414)).then((png) => {
        out.card = png;
      }),
    );
  }
  if (input.flyer) {
    tasks.push(
      svgStringToPngDataUrl(buildFlyerSvg(input.flyer, { renderBodyAsText: true })).then((png) => {
        out.flyer = png;
      }),
    );
  }
  await Promise.all(tasks);
  return out;
}
