/**
 * The brand layer.
 *
 * Nothing outside this directory may contain a colour literal or a product name.
 * When the ARPS brand pack arrives, `theme.arps.ts` drops in beside the neutral
 * theme and the export at the bottom changes — one file, no hunting.
 */

import type { MixKind } from '@pourline/sim';

export interface Theme {
  name: string;

  /**
   * Font stacks. The real ARPS brand face is a licensed geometric sans (see
   * CLIENT-REQUIREMENTS 3.3) that isn't in the repo yet, so both slots use
   * robust system stacks for now — no webfont request, which keeps the game
   * loading instantly on bad venue wifi and working fully offline. When the
   * licensed font lands, self-host it and change these two lines only.
   *
   * `display` is for the wordmark and headline numbers, always paired with
   * letter-spacing and caps in code to echo the spaced geometric ARPS lockup.
   */
  fonts: {
    display: string;
    body: string;
  };

  /** Company mark, e.g. "ARPS". Shown as an eyebrow above the game name. */
  brand: string;

  colors: {
    bg: number;
    bgAccent: number;
    ground: number;
    groundLine: number;

    formwork: number;
    formworkDim: number;
    concrete: number;
    concreteWet: number;

    targetLine: number;
    perfectBand: number;

    chute: number;
    chuteMouth: number;

    text: number;
    textDim: number;
    good: number;
    danger: number;
    accent: number;
    /**
     * Ink for text sitting ON an accent-coloured surface (buttons, badges, the
     * demo tag). Kept separate from `bg` because it must stay dark whether the
     * theme's background is dark or light — light text on orange washes out.
     */
    onAccent: number;

    /**
     * Leaderboard rank badges (1st/2nd/3rd). Named separately from `accent`
     * even though rankGold currently matches it — the two mean different
     * things and may need to move independently once a real brand accent
     * replaces this neutral one.
     */
    rankGold: number;
    rankSilver: number;
    rankBronze: number;
  };

  /** Placeholder mix labels. Replaced with real ARPS product names. */
  productNames: Record<MixKind, string>;

  /** Shown on the title and results screens until a logo asset exists. */
  wordmark: string;
}

/**
 * Neutral industrial palette — concrete greys, safety yellow, hazard orange.
 * Deliberately high contrast: this gets played under expo hall lighting, often
 * in direct sun, on phones with the brightness turned down to save battery.
 */
export const neutralTheme: Theme = {
  name: 'neutral',

  fonts: {
    display: '"Helvetica Neue", Arial, system-ui, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  brand: '',

  colors: {
    bg: 0x14161a,
    bgAccent: 0x1c2027,
    ground: 0x23272f,
    groundLine: 0x3a4049,

    formwork: 0x8a929e,
    formworkDim: 0x4a515c,
    concrete: 0x9aa3ae,
    concreteWet: 0xb4bcc6,

    targetLine: 0xffc21a,
    perfectBand: 0x3ddc84,

    chute: 0x6b7280,
    chuteMouth: 0x99a1ad,

    text: 0xf2f4f7,
    textDim: 0x8a929e,
    good: 0x3ddc84,
    danger: 0xff5a3c,
    accent: 0xffc21a,
    onAccent: 0x14161a,

    rankGold: 0xffc21a,
    rankSilver: 0xc7ccd4,
    rankBronze: 0xcd7f4a,
  },

  productNames: {
    mortar: 'Mortar Mix',
    highStrength: 'High-Strength',
    general: 'General Purpose',
    screed: 'Screed',
  },

  wordmark: 'POUR LINE',
};

// The active theme. Swap this one line to re-brand the whole game — neutralTheme
// is kept as the pre-brand fallback and reference. arpsTheme is defined in its
// own file (type-only import back to here, so no runtime cycle).
export { arpsTheme as theme } from './theme.arps.ts';

/** Phaser text styles want CSS colour strings, the draw API wants numbers. */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Same conversion, with alpha — for CSS glows/flashes that need to fade. */
export function cssRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
