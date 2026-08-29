import type { MixKind } from '@pourline/sim';

export interface Theme {
  fonts: { display: string; body: string };
  /** Company mark shown as an eyebrow above the game name. */
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
    /** Ink for text on an accent-coloured surface (buttons, badges). */
    onAccent: number;
    rankGold: number;
    rankSilver: number;
    rankBronze: number;
  };
  productNames: Record<MixKind, string>;
  wordmark: string;
}

/** ARPS brand — light grey ground, navy structure and text, hazard orange accent. */
export const theme: Theme = {
  fonts: {
    display: '"Helvetica Neue", Arial, system-ui, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  brand: 'ARPS',

  colors: {
    bg: 0xf0f2f5,
    bgAccent: 0xe1e5ec,
    ground: 0xd6dbe2,
    groundLine: 0xc3cad4,

    formwork: 0x1e2f4d,
    formworkDim: 0x939ead,
    concrete: 0x6f7988,
    concreteWet: 0x828e9e,

    targetLine: 0xe64f2a,
    perfectBand: 0x1fa35e,

    chute: 0x2a3e60,
    chuteMouth: 0xaeb7c3,

    text: 0x1e2f4d,
    textDim: 0x6a7787,
    good: 0x1fa35e,
    danger: 0xd93a26,
    accent: 0xe64f2a,
    onAccent: 0x152238,

    rankGold: 0xe64f2a,
    rankSilver: 0x9aa4b4,
    rankBronze: 0xc5824e,
  },

  productNames: {
    mortar: 'Mortar Mix',
    highStrength: 'High-Strength',
    general: 'General Purpose',
    screed: 'Screed',
  },

  wordmark: 'POUR LINE',
};

/** Converts a 0xRRGGBB colour to a CSS hex string. */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Converts a 0xRRGGBB colour to a CSS rgba() string with the given alpha. */
export function cssRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
