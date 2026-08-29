import { css, cssRgba, theme } from './theme.ts';

/**
 * Projects theme.ts onto CSS custom properties, for the plain-HTML pages
 * (leaderboard, register) that can't use Phaser's draw API. Single source of
 * truth stays theme.ts — nothing here is a colour literal, and any page using
 * this must not define its own fallback values beyond the boot-background
 * `var(--bg, #hex)` pattern used before this script has run.
 */
export function applyThemeVars(): void {
  const root = document.documentElement.style;
  const c = theme.colors;

  root.setProperty('--bg', css(c.bg));
  root.setProperty('--bg-accent', css(c.bgAccent));
  root.setProperty('--ground-line', css(c.groundLine));
  root.setProperty('--formwork', css(c.formwork));
  root.setProperty('--formwork-dim', css(c.formworkDim));
  root.setProperty('--text', css(c.text));
  root.setProperty('--text-dim', css(c.textDim));
  root.setProperty('--good', css(c.good));
  root.setProperty('--danger', css(c.danger));
  root.setProperty('--accent', css(c.accent));
  root.setProperty('--on-accent', css(c.onAccent));
  root.setProperty('--rank-gold', css(c.rankGold));
  root.setProperty('--rank-silver', css(c.rankSilver));
  root.setProperty('--rank-bronze', css(c.rankBronze));

  root.setProperty('--font-display', theme.fonts.display);
  root.setProperty('--font-body', theme.fonts.body);

  // Row striping as a text-tinted alpha rather than a hardcoded white overlay,
  // so it stays correct if the theme ever flips light (white-alpha would
  // vanish on a light ground; text-alpha tracks the theme in both directions).
  root.setProperty('--row-alt', cssRgba(c.text, 0.035));

  // Alpha variants for animations/decoration that need to fade a brand colour
  // rather than show it flat — computed here so the literal only exists once.
  root.setProperty('--good-glow', cssRgba(c.good, 0.55));
  root.setProperty('--good-glow-clear', cssRgba(c.good, 0));
  root.setProperty('--accent-flash', cssRgba(c.accent, 0.22));
  root.setProperty('--accent-faint', cssRgba(c.accent, 0.06));
  root.setProperty('--formwork-faint', cssRgba(c.formwork, 0.05));
}

/** Sets the shared header wordmark/brand text elements, if a page has them. */
export function applyBrandText(): void {
  const wordmark = document.getElementById('wordmark');
  if (wordmark) wordmark.textContent = theme.wordmark;

  const brand = document.getElementById('brand');
  if (brand) {
    if (theme.brand) brand.textContent = theme.brand;
    else brand.remove();
  }
}
