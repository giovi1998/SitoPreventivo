import type { Flyer, FlyerLayout } from '../documentSchemas';
import { FONT_SCALE_MIN, FONT_SCALE_MAX } from '../documentSchemas';
import {
  type FlyerLayoutPlan,
  type FlyerElementId,
  type FlyerLayoutWarning,
  type MmRect,
  type FlyerDensity,
  FONT_SIZE_BOUNDS,
  SAFE_AREA_INSET_MM,
  GAP_MM,
  QR_MIN_MM,
  QR_MAX_MM_RATIO,
  HERO_HEIGHT_RATIO,
  FOOTER_H_MM,
  FOOTER_SAFE_GAP_MM,
  buildPageRects,
  normalizeContent,
  hasQrUrl,
  isCtaValid,
  classDensity,
  clamp,
  rectsOverlap,
  rectInside,
  emptyFitted,
} from './geometry';
import { fitText, fitBodyText, type FitTextOptions } from './textFit';

export function computeFlyerLayout(flyer: Flyer): FlyerLayoutPlan {
  const page = buildPageRects(flyer);
  const content = normalizeContent(flyer);
  const layout = flyer.style.layout;
  const rawBounds = FONT_SIZE_BOUNDS[flyer.size];
  const scale = clamp(flyer.style.fontScale ?? 1, FONT_SCALE_MIN, FONT_SCALE_MAX);
  const bounds: typeof rawBounds = {
    headline: { min: rawBounds.headline.min * scale, max: rawBounds.headline.max * scale },
    subheadline: { min: rawBounds.subheadline.min * scale, max: rawBounds.subheadline.max * scale },
    body: { min: rawBounds.body.min * scale, max: rawBounds.body.max * scale },
    cta: { min: rawBounds.cta.min * scale, max: rawBounds.cta.max * scale },
  };
  const dims = page.trim;
  const safe = page.safe;
  const hasHero = !!content.heroImage;
  const hasQr = hasQrUrl(content);
  const hasCta = isCtaValid(content);
  const hasCtaLabel = !!content.ctaLabel;

  const warnings: FlyerLayoutWarning[] = [];
  const boxes: Partial<Record<FlyerElementId, MmRect>> = {};
  const visibility: Record<FlyerElementId, boolean> = {
    hero: hasHero,
    headline: false,
    subheadline: false,
    accent: false,
    body: false,
    cta: false,
    qr: false,
    qrLabel: false,
  };
  const overflowFlags: Record<string, boolean> = {};

  // QR/CTA footer sizing
  const qrMin = QR_MIN_MM[flyer.size];
  const qrMax = clamp(safe.w * QR_MAX_MM_RATIO, qrMin, Math.min(safe.w, safe.h) * 0.25);
  let qrSize = hasQr ? clamp(safe.w * 0.16, qrMin, qrMax) : 0;
  const ctaH = FOOTER_H_MM;
  const footerH = computeFooterHeight(hasCta, hasQr, qrSize, content.qrLabel);
  const footerSafeY = safe.y + safe.h - footerH;

  // 1. Compute hero box
  let heroBox: MmRect | undefined;
  let textArea: MmRect = { ...safe };
  if (hasHero) {
    heroBox = computeHeroBox(layout, safe, hasHero, dims, flyer.size);
    if (heroBox) {
      textArea = computeTextArea(layout, safe, heroBox, dims);
      boxes.hero = heroBox;
    }
  }

  // 2. Compute footer area
  const footerArea: MmRect = {
    x: safe.x,
    y: footerSafeY,
    w: safe.w,
    h: footerH,
  };
  // Text area is trimmed by footer
  textArea.h = Math.max(12, footerArea.y - textArea.y - FOOTER_SAFE_GAP_MM);

  // Store the computed text area for renderer parity
  const finalTextArea: MmRect = { ...textArea };

  // 3. Compute CTA width constrained to the text area before fitting text.
  const footerX = textArea.x;
  const footerW = textArea.w;
  const ctaW = hasCtaLabel
    ? (hasQr
        ? clamp(footerW - qrSize - GAP_MM - 4, 24, footerW * 0.65)
        : clamp(footerW * 0.85, 30, footerW * 0.95))
    : 0;

  // 4. Compute text stack within textArea
  const textStack = computeTextStack(
    layout, content, textArea, flyer.size, bounds,
    hasCtaLabel, hasCta, ctaW, ctaH, qrSize, footerArea
  );

  // Merge boxes. Preserve hero visibility set above.
  Object.assign(boxes, textStack.boxes);
  const heroVisibility = visibility.hero;
  Object.assign(visibility, textStack.visibility);
  visibility.hero = heroVisibility;
  warnings.push(...textStack.warnings);
  Object.assign(overflowFlags, textStack.overflowFlags);

  let qrLabelFit = emptyFitted(bounds.cta.min);

  // 5. CTA and QR boxes (constrained to the text area, not the whole safe area)
  if (hasCtaLabel) {
    const ctaBox = layout === 'centered'
      ? { x: footerX + (footerW - ctaW) / 2, y: footerArea.y + (footerArea.h - ctaH) / 2, w: ctaW, h: ctaH }
      : { x: footerX, y: footerArea.y + (footerArea.h - ctaH) / 2, w: ctaW, h: ctaH };
    boxes.cta = ctaBox;
    visibility.cta = true;
  }

  if (hasQr) {
    let qrX = footerX + footerW - qrSize;
    let qrY = footerArea.y + (footerArea.h - qrSize) / 2;
    if (hasCtaLabel && qrX < footerX + ctaW + GAP_MM) {
      // collision: shrink QR or hide label
      if (qrSize > qrMin) {
        const newQrSize = clamp(footerW - ctaW - GAP_MM, qrMin, qrSize);
        if (newQrSize >= qrMin) {
          qrSize = newQrSize;
          qrX = footerX + footerW - qrSize;
        }
      }
    }
    if (qrX >= footerX + ctaW + GAP_MM || !hasCtaLabel) {
      boxes.qr = { x: qrX, y: qrY, w: qrSize, h: qrSize };
      visibility.qr = true;
      if (content.qrLabel) {
        const labelY = qrY + qrSize + 1;
        const maxLabelH = Math.max(0, footerArea.y + footerArea.h - labelY - 0.5);
        const labelBox: MmRect = {
          x: qrX,
          y: labelY,
          w: qrSize,
          h: Math.max(4, Math.min(footerArea.h - qrSize - 2, maxLabelH)),
        };
        if (labelBox.h >= 4 && labelBox.y + labelBox.h <= footerArea.y + footerArea.h + 0.1) {
          boxes.qrLabel = labelBox;
          visibility.qrLabel = true;
          const qrLabelFitResult = fitText({
            id: 'qrLabel',
            text: content.qrLabel,
            box: labelBox,
            minFontSizePt: 5,
            maxFontSizePt: 7,
            lineHeight: 1.1,
            align: 'center',
            hidden: false,
            debugName: 'Etichetta QR',
            kind: 'regular',
            maxLines: 2,
          });
          qrLabelFit = qrLabelFitResult.block;
          if (qrLabelFitResult.block.truncated) overflowFlags.qrLabel = true;
          warnings.push(...qrLabelFitResult.warnings);
        } else {
          // Fallback: place label between the CTA and the QR (if CTA present)
          const ctaRight = hasCtaLabel ? footerX + ctaW + GAP_MM : footerX;
          const sideLabelW = qrX - ctaRight - GAP_MM;
          if (sideLabelW >= 12) {
            const sideBox: MmRect = {
              x: ctaRight,
              y: footerArea.y,
              w: sideLabelW,
              h: footerArea.h,
            };
            const sideFit = fitText({
              id: 'qrLabel',
              text: content.qrLabel,
              box: sideBox,
              minFontSizePt: 5,
              maxFontSizePt: 7,
              lineHeight: 1.1,
              align: 'left',
              hidden: false,
              debugName: 'Etichetta QR',
              kind: 'regular',
              maxLines: 3,
            });
            if (!sideFit.block.truncated) {
              boxes.qrLabel = sideBox;
              visibility.qrLabel = true;
              qrLabelFit = sideFit.block;
              warnings.push(...sideFit.warnings);
            } else {
              warnings.push({ code: 'qr_label_hidden', severity: 'info', message: 'Etichetta QR nascosta per mancanza di spazio.', element: 'qrLabel' });
            }
          } else {
            warnings.push({ code: 'qr_label_hidden', severity: 'info', message: 'Etichetta QR nascosta per mancanza di spazio.', element: 'qrLabel' });
          }
        }
      }
    } else {
      warnings.push({ code: 'qr_hidden', severity: 'warning', message: 'QR nascosto: spazio insufficiente nel footer.', element: 'qr' });
    }
  }

  // 5. Body fitting
  const bodyBox = boxes.body;
  let bodyFit: ReturnType<typeof fitBodyText>['block'] = emptyFitted(bounds.body.min);
  if (bodyBox && content.body && visibility.body) {
    const columnCount = layout === 'magazine' ? magazineColumnCount(flyer.size, bodyBox.h) : 1;
    const bodyResult = fitBodyText(
      content.body,
      bodyBox,
      bounds.body.min,
      bounds.body.max,
      1.3,
      columnCount,
    );
    bodyFit = bodyResult.block;
    warnings.push(...bodyResult.warnings);
    if (bodyFit.truncated) overflowFlags.body = true;
  }

  // 6. Validate no overlaps
  const visibleBoxes = Object.entries(boxes)
    .filter(([k]) => visibility[k as FlyerElementId])
    .map(([, v]) => v) as MmRect[];
  for (let i = 0; i < visibleBoxes.length; i++) {
    for (let j = i + 1; j < visibleBoxes.length; j++) {
      if (rectsOverlap(visibleBoxes[i], visibleBoxes[j])) {
        warnings.push({ code: 'layout_overflow', severity: 'error', message: 'Sovrapposizione elementi nel layout.' });
        overflowFlags.layout_overflow = true;
      }
    }
  }
  // Ensure all visible boxes inside safe area
  for (const b of visibleBoxes) {
    if (!rectInside(b, safe, 0.1)) {
      warnings.push({ code: 'layout_overflow', severity: 'error', message: 'Elemento fuori dall\'area sicura.' });
      overflowFlags.layout_overflow = true;
    }
  }

  const density = classDensity({ overflowFlags, text: { body: bodyFit } as any, visibility } as FlyerLayoutPlan);

  const plan: FlyerLayoutPlan = {
    page,
    layout,
    size: flyer.size,
    orientation: flyer.orientation,
    density,
    textArea: finalTextArea,
    boxes,
    text: {
      headline: textStack.text.headline,
      subheadline: textStack.text.subheadline,
      body: bodyFit,
      cta: textStack.text.cta,
      qrLabel: qrLabelFit,
    },
    visibility,
    warnings,
    overflowFlags,
  };

  return plan;
}

function computeFooterHeight(hasCtaLabel: boolean, hasQr: boolean, qrSize: number, qrLabel?: string): number {
  if (!hasCtaLabel && !hasQr) return 0;
  const contentH = Math.max(hasCtaLabel ? FOOTER_H_MM : 0, hasQr ? qrSize : 0);
  let h = contentH + 2;
  if (hasQr && qrLabel) h += 6;
  return Math.max(0, h);
}

function computeHeroBox(layout: FlyerLayout, safe: MmRect, hasHero: boolean, dims: MmRect, size: Flyer['size']): MmRect | undefined {
  if (!hasHero) return undefined;
  const gap = GAP_MM;
  switch (layout) {
    case 'classic': {
      const ratio = HERO_HEIGHT_RATIO.classic[size];
      return { x: safe.x, y: safe.y, w: safe.w, h: clamp(safe.h * ratio, 12, safe.h * 0.45) };
    }
    case 'centered': {
      const ratio = HERO_HEIGHT_RATIO.centered[size];
      const w = clamp(safe.w * 0.5, 20, safe.w * 0.7);
      return { x: safe.x + (safe.w - w) / 2, y: safe.y, w, h: clamp(safe.h * ratio, 10, safe.h * 0.22) };
    }
    case 'magazine': {
      const ratio = HERO_HEIGHT_RATIO.magazine[size];
      return { x: safe.x, y: safe.y, w: safe.w, h: clamp(safe.h * ratio, 10, safe.h * 0.30) };
    }
    case 'split': {
      const isLandscape = dims.w >= dims.h;
      if (isLandscape) {
        const heroW = clamp(safe.w * 0.46, 30, safe.w * 0.55);
        return { x: safe.x, y: safe.y, w: heroW, h: safe.h };
      }
      const heroH = clamp(safe.h * 0.5, 30, safe.h * 0.55);
      return { x: safe.x, y: safe.y, w: safe.w, h: heroH };
    }
  }
}

function computeTextArea(layout: FlyerLayout, safe: MmRect, heroBox: MmRect, dims: MmRect): MmRect {
  const gap = GAP_MM;
  switch (layout) {
    case 'split': {
      const isLandscape = dims.w >= dims.h;
      if (isLandscape) {
        return { x: heroBox.x + heroBox.w + gap, y: safe.y, w: safe.w - heroBox.w - gap, h: safe.h };
      }
      return { x: safe.x, y: heroBox.y + heroBox.h + gap, w: safe.w, h: safe.h - heroBox.h - gap };
    }
    case 'centered': {
      return { x: safe.x, y: heroBox.y + heroBox.h + gap, w: safe.w, h: safe.h - heroBox.h - gap };
    }
    case 'magazine':
    case 'classic':
    default: {
      return { x: safe.x, y: heroBox.y + heroBox.h + gap, w: safe.w, h: safe.h - heroBox.h - gap };
    }
  }
}

function computeTextStack(
  layout: FlyerLayout,
  content: ReturnType<typeof normalizeContent>,
  textArea: MmRect,
  size: Flyer['size'],
  bounds: (typeof FONT_SIZE_BOUNDS)[Flyer['size']],
  hasCtaLabel: boolean,
  hasCta: boolean,
  ctaW: number,
  ctaH: number,
  qrSize: number,
  footerArea: MmRect,
) {
  const boxes: Partial<Record<FlyerElementId, MmRect>> = {};
  const visibility: Record<FlyerElementId, boolean> = {
    hero: false, headline: false, subheadline: false, accent: false,
    body: false, cta: false, qr: false, qrLabel: false,
  };
  const warnings: FlyerLayoutWarning[] = [];
  const overflowFlags: Partial<Record<FlyerElementId, boolean>> = {};
  const textBlocks: FlyerLayoutPlan['text'] = {
    headline: emptyFitted(bounds.headline.min),
    subheadline: emptyFitted(bounds.subheadline.min),
    body: emptyFitted(bounds.body.min),
    cta: emptyFitted(bounds.cta.min),
    qrLabel: emptyFitted(bounds.cta.min),
  };
  // qrLabel is fitted in computeFlyerLayout after the QR box is known.

  const centered = layout === 'centered';
  const magazine = layout === 'magazine';
  let cursorY = textArea.y;
  const maxTextY = textArea.y + textArea.h;

  // Headline
  if (content.headline) {
    const align = centered ? 'center' : 'left';
    const maxW = textArea.w;
    const headlineBox: MmRect = {
      x: textArea.x,
      y: cursorY,
      w: maxW,
      h: clamp(textArea.h * 0.35, 10, maxTextY - cursorY),
    };
    const fit = fitText({
      id: 'headline',
      text: content.headline,
      box: headlineBox,
      minFontSizePt: bounds.headline.min,
      maxFontSizePt: bounds.headline.max,
      lineHeight: 1.1,
      align,
      upperCase: true,
      hidden: false,
      debugName: 'Headline',
      kind: 'boldUpper',
      maxLines: size === 'A6' ? 2 : 3,
    });
    textBlocks.headline = fit.block;
    if (fit.block.truncated) overflowFlags.headline = true;
    warnings.push(...fit.warnings);
    boxes.headline = { ...headlineBox, h: (fit.block.lines.length - 1) * fit.block.fontSizePt * fit.block.lineHeight * 0.352777778 + fit.block.fontSizePt * 1.15 * 0.352777778 };
    visibility.headline = true;
    cursorY = boxes.headline.y + boxes.headline.h + GAP_MM;

    // Accent bar
    if (cursorY + 1.5 <= maxTextY) {
      const accentW = Math.max(4, textArea.w * 0.06);
      const accentX = centered ? textArea.x + (textArea.w - accentW) / 2 : textArea.x;
      boxes.accent = { x: accentX, y: cursorY, w: accentW, h: 0.8 };
      visibility.accent = true;
      cursorY += 0.8 + GAP_MM;
    }
  }

  // Subheadline (fallback 2a: hide if headline was truncated to give body more room)
  if (content.subheadline && !textBlocks.headline.truncated && cursorY + bounds.subheadline.min * 0.5 <= maxTextY) {
    const align = centered ? 'center' : 'left';
    const subBox: MmRect = {
      x: textArea.x,
      y: cursorY,
      w: textArea.w,
      h: clamp(textArea.h * 0.18, 8, maxTextY - cursorY),
    };
    const fit = fitText({
      id: 'subheadline',
      text: content.subheadline,
      box: subBox,
      minFontSizePt: bounds.subheadline.min,
      maxFontSizePt: bounds.subheadline.max,
      lineHeight: 1.2,
      align,
      hidden: false,
      debugName: 'Sottotitolo',
      kind: 'regular',
      maxLines: 2,
    });
    // If subheadline itself is truncated, hide it instead (priority: title > body > subheadline)
    if (fit.block.truncated) {
      textBlocks.subheadline = emptyFitted(bounds.subheadline.min);
      warnings.push({ code: 'subheadline_hidden', severity: 'info', message: 'Sottotitolo nascosto per far spazio al titolo/corpo.', element: 'subheadline' });
    } else {
      textBlocks.subheadline = fit.block;
      boxes.subheadline = { ...subBox, h: (fit.block.lines.length - 1) * fit.block.fontSizePt * fit.block.lineHeight * 0.352777778 + fit.block.fontSizePt * 1.15 * 0.352777778 };
      visibility.subheadline = true;
      cursorY = boxes.subheadline.y + boxes.subheadline.h + GAP_MM;
    }
  }

  // Body
  if (content.body && cursorY + bounds.body.min * 0.5 <= maxTextY) {
    const bodyBox: MmRect = {
      x: textArea.x,
      y: cursorY,
      w: textArea.w,
      h: Math.max(12, maxTextY - cursorY),
    };
    boxes.body = bodyBox;
    visibility.body = true;
  }

  // CTA text block (not used by renderer directly, but tracked in plan)
  if (hasCtaLabel) {
    const ctaBox: MmRect = {
      x: footerArea.x,
      y: footerArea.y,
      w: ctaW,
      h: ctaH,
    };
    const fit = fitText({
      id: 'cta',
      text: content.ctaLabel,
      box: { ...ctaBox, h: ctaH * 0.8 },
      minFontSizePt: bounds.cta.min,
      maxFontSizePt: bounds.cta.max,
      lineHeight: 1.0,
      align: 'center',
      upperCase: true,
      hidden: false,
      maxLines: 1,
      debugName: 'CTA',
      kind: 'boldUpperCta',
    });
    textBlocks.cta = fit.block;
    if (fit.block.truncated) {
      overflowFlags.cta = true;
      warnings.push({ code: 'cta_truncated', severity: 'warning', message: 'CTA troppo lunga: abbrevia il testo del bottone.', element: 'cta' });
    }
  }

  return { boxes, visibility, warnings, overflowFlags, text: textBlocks };
}

export function magazineColumnCount(size: Flyer['size'], availableH: number): number {
  if (size === 'A6') return 1;
  if (size === 'A5' || size === 'Square') return 2;
  if (availableH < 30) return 2;
  return 3;
}

export function debugPlanSummary(plan: FlyerLayoutPlan): string {
  const lines: string[] = [];
  lines.push(`Layout: ${plan.layout} ${plan.size} ${plan.orientation} | density: ${plan.density}`);
  for (const [id, box] of Object.entries(plan.boxes)) {
    if (!box) continue;
    const vis = plan.visibility[id as FlyerElementId] ? 'visible' : 'hidden';
    lines.push(`  ${id}: ${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.w.toFixed(1)}×${box.h.toFixed(1)} [${vis}]`);
  }
  return lines.join('\n');
}
