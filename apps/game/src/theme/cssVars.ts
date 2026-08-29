import { css, cssRgba, theme } from './theme.ts';

/** Projects the theme onto CSS custom properties for the plain-HTML pages. */
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

  root.setProperty('--row-alt', cssRgba(c.text, 0.035));
  root.setProperty('--accent-flash', cssRgba(c.accent, 0.22));
  root.setProperty('--accent-faint', cssRgba(c.accent, 0.06));
  root.setProperty('--formwork-faint', cssRgba(c.formwork, 0.05));
}

/** Fills the shared header wordmark/brand elements, if the page has them. */
export function applyBrandText(): void {
  const wordmark = document.getElementById('wordmark');
  if (wordmark) wordmark.textContent = theme.wordmark;

  const brand = document.getElementById('brand');
  if (brand) {
    if (theme.brand) brand.textContent = theme.brand;
    else brand.remove();
  }
}
