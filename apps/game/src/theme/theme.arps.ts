/**
 * ARPS brand theme — the active look.
 *
 * A light expression matching the ARPS logo directly: cool light-grey ground
 * (the logo's map field), deep corporate navy for structure and text, hazard
 * orange as the hero accent. This mirrors the white-background brand lockup
 * rather than inverting it.
 *
 * Light-ground note: several tokens have to be read against a *pale* surface,
 * which is the opposite of most game palettes. Text and structure go dark;
 * concrete goes mid-grey so it still reads inside a pale mould; `onAccent` is a
 * dark ink so button/badge text stays legible on orange. When editing, check
 * contrast against `bg`, not against black.
 *
 * Type-only import back to theme.ts, so there is no runtime import cycle with
 * the `export { arpsTheme as theme }` line there.
 */

import type { MixKind } from '@pourline/sim';
import type { Theme } from './theme.ts';

export const arpsTheme: Theme = {
  name: 'arps',

  fonts: {
    display: '"Helvetica Neue", Arial, system-ui, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  brand: 'ARPS',

  colors: {
    // Grounds — soft cool light-grey, echoing the logo's pale map field. Not
    // pure white, which glares under expo lighting. bgAccent is a slightly
    // deeper grey so a mould interior and the leaderboard panels read as a
    // gentle recess against the ground.
    bg: 0xf0f2f5,
    bgAccent: 0xe1e5ec,
    ground: 0xd6dbe2,
    groundLine: 0xc3cad4,

    // Structure — brand navy for mould walls and outlines, a mid-grey for the
    // dimmed/evaluated state and empty strike pips.
    formwork: 0x1e2f4d,
    formworkDim: 0x939ead,
    // Concrete stays mid-grey so a filling mould shows clearly against its pale
    // interior and the light ground.
    concrete: 0x6f7988,
    concreteWet: 0x828e9e,

    // The two most important marks on screen.
    // Target line = hazard orange, the brand's energy colour, on every mould.
    // Perfect band = green: success reads green almost universally, and it is
    // the one functional signal worth keeping off-brand so nobody misreads the
    // reward zone. Deepened for a light ground.
    targetLine: 0xe64f2a,
    perfectBand: 0x1fa35e,

    chute: 0x2a3e60,
    chuteMouth: 0xaeb7c3,

    text: 0x1e2f4d,
    textDim: 0x6a7787,
    good: 0x1fa35e,
    // Danger is a truer red than the orange accent, so a spill never reads as
    // the same hue as the aim line — reinforced by shake, hitch and the fill
    // flooding red, so the two are never actually confused in play.
    danger: 0xd93a26,
    accent: 0xe64f2a,
    // Dark navy ink — legible on orange/badge fills against a light ground.
    onAccent: 0x152238,

    // Podium: the leader takes the brand orange (a real pop for 1st place),
    // then cool grey and bronze for 2nd and 3rd. Badge text uses onAccent.
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
