import React from 'react';
import type { Tier } from '../utils/watermark';

interface PreviewWatermarkProps {
  tier: Tier;
  className?: string;
}

/**
 * In-page watermark overlay applied to live previews (card, QR, logo).
 * Renders a diagonal repeating text pattern via SVG so users cannot
 * "screenshot to bypass" — even DOM-screenshots include the watermark
 * baked into the visible rendering.
 *
 * The watermark is rendered on a transparent layer above the preview
 * content, using `pointer-events: none` so it never blocks user
 * interaction. The `aria-hidden` keeps it out of the accessibility tree.
 *
 * For unlocked users, the overlay is a no-op (returns null).
 */
export default function PreviewWatermark({ tier, className }: PreviewWatermarkProps) {
  if (tier === 'unlocked') return null;
  return (
    <svg
      className={`preview-watermark ${className || ''}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="preview-watermark-pattern"
          patternUnits="userSpaceOnUse"
          width="220"
          height="90"
          patternTransform="rotate(-30)"
        >
          <text
            x="0"
            y="40"
            textAnchor="start"
            fontFamily="Helvetica, Arial, sans-serif"
            fontSize="22"
            fontWeight="700"
            fill="#0B57D0"
            fillOpacity="0.13"
            letterSpacing="1.5"
          >
            PRECISIONQUOTE · FREE
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#preview-watermark-pattern)" />
    </svg>
  );
}
