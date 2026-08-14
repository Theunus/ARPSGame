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
  },

  productNames: {
    mortar: 'Mortar Mix',
    highStrength: 'High-Strength',
    general: 'General Purpose',
    screed: 'Screed',
  },

  wordmark: 'POUR LINE',
};

export const theme: Theme = neutralTheme;

/** Phaser text styles want CSS colour strings, the draw API wants numbers. */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
