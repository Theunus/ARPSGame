import { css, cssRgba, theme } from '../theme/theme.ts';
import { fetchLeaderboard } from './data.ts';
import type { LeaderboardRow } from './types.ts';

/**
 * Big-screen leaderboard — apps/game/leaderboard.html.
 *
 * A plain data table, not a Phaser scene: this is meant to run unattended on
 * a laptop driving a TV at the stand (see artifacts/grill-me/PourLine-Grill-Me-6.md),
 * so it needs to be a normal web page a browser can sit on for hours, not a
 * game loop. No pointer device is expected on that laptop, so unlike the
 * phone game there is deliberately no hover/interaction layer here.
 *
 * Currently reads sample data from ./data.ts — see the comment there for
 * exactly what changes when the real backend lands. Nothing in this file is
 * backend-specific; it only knows about the LeaderboardRow shape.
 */

const REFRESH_MS = 15_000;
const MAX_ROWS = 50;

function applyThemeVars(): void {
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
  root.setProperty('--accent', css(c.accent));
  root.setProperty('--on-accent', css(c.onAccent));
  root.setProperty('--rank-gold', css(c.rankGold));
  root.setProperty('--rank-silver', css(c.rankSilver));
  root.setProperty('--rank-bronze', css(c.rankBronze));

  root.setProperty('--font-display', theme.fonts.display);
  root.setProperty('--font-body', theme.fonts.body);

  // Row striping as a text-tinted alpha rather than a hardcoded white overlay,
  // so it stays correct if the theme ever flips light (white-alpha would vanish
  // on a light ground; text-alpha tracks the theme in both directions).
  root.setProperty('--row-alt', cssRgba(c.text, 0.035));

  // Alpha variants for the CSS animations that fade a brand colour rather than
  // show it flat — computed here so the literal only exists once, in theme.ts.
  root.setProperty('--good-glow', cssRgba(c.good, 0.55));
  root.setProperty('--good-glow-clear', cssRgba(c.good, 0));
  root.setProperty('--accent-flash', cssRgba(c.accent, 0.22));
  root.setProperty('--accent-faint', cssRgba(c.accent, 0.06));
  root.setProperty('--formwork-faint', cssRgba(c.formwork, 0.05));
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`leaderboard.html is missing #${id}`);
  return el as T;
}

const rowsEl = byId<HTMLTableSectionElement>('rows');
const updatedTextEl = byId<HTMLElement>('updated-text');
const countTextEl = byId<HTMLElement>('count-text');

let lastGoodAt: number | null = null;
let previousByKey = new Map<string, LeaderboardRow>();

// A real backend will key this by player id. Display name is good enough for
// sample data and degrades harmlessly (a missed highlight, nothing worse) if
// two mock players ever share a name.
function rowKey(row: LeaderboardRow): string {
  return row.displayName;
}

function formatScore(n: number): string {
  return n.toLocaleString('en-ZA');
}

function badgeClass(rank: number): '' | 'gold' | 'silver' | 'bronze' {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

/** Escapes free-text before it goes into innerHTML. Only displayName needs this. */
function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function renderSkeleton(rowCount = 8): void {
  rowsEl.innerHTML = '';
  for (let i = 0; i < rowCount; i++) {
    const tr = document.createElement('tr');
    tr.className = 'skeleton-row';
    tr.style.animation = 'none';
    tr.style.opacity = '1';
    tr.innerHTML = `
      <td><div class="skeleton-bar" style="width: 2.4em"></div></td>
      <td><div class="skeleton-bar" style="width: 8em"></div></td>
      <td class="num"><div class="skeleton-bar" style="width: 5em; margin-left: auto"></div></td>
      <td class="num combo"><div class="skeleton-bar" style="width: 2em; margin-left: auto"></div></td>
      <td class="num moulds"><div class="skeleton-bar" style="width: 2em; margin-left: auto"></div></td>
    `;
    rowsEl.appendChild(tr);
  }
}

function renderRows(rows: LeaderboardRow[], animateEntrance: boolean): void {
  rowsEl.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="empty">No runs yet — be the first on the board.</td>`;
    rowsEl.appendChild(tr);
    previousByKey = new Map();
    return;
  }

  rows.forEach((row, i) => {
    const prev = previousByKey.get(rowKey(row));
    const changed = !!prev && (prev.rank !== row.rank || prev.score !== row.score);

    const tr = document.createElement('tr');
    if (changed) tr.classList.add('changed');

    if (animateEntrance) {
      // Staggered, capped so a long board doesn't take forever to finish
      // appearing — past ~20 rows every row after that comes in together.
      tr.style.animationDelay = `${Math.min(i, 20) * 35}ms`;
    } else {
      // Not first paint: only rows flagged `changed` above should draw the
      // eye. Replaying the entrance animation for the whole board every
      // refresh would make genuine changes harder to notice, not easier.
      tr.style.animation = changed ? '' : 'none';
      tr.style.opacity = '1';
    }

    const badge = badgeClass(row.rank);
    const rankHtml = badge
      ? `<span class="rank-badge ${badge}">${row.rank}</span>`
      : `<span class="rank-plain">${row.rank}</span>`;

    tr.innerHTML = `
      <td><span class="rank-cell">${rankHtml}</span></td>
      <td class="name-cell">${escapeHtml(row.displayName)}</td>
      <td class="num score-cell">${formatScore(row.score)}</td>
      <td class="num combo-cell">x${row.bestCombo}</td>
      <td class="num moulds-cell">${row.mouldsCompleted}</td>
    `;
    rowsEl.appendChild(tr);
  });

  previousByKey = new Map(rows.map((r) => [rowKey(r), r]));
}

function updateStatusText(): void {
  if (lastGoodAt === null) return;
  const secs = Math.round((Date.now() - lastGoodAt) / 1000);
  updatedTextEl.textContent = secs < 2 ? 'Updated just now' : `Updated ${secs}s ago`;
}

async function refresh(isFirst: boolean): Promise<void> {
  if (isFirst) renderSkeleton();

  try {
    const rows = await fetchLeaderboard(MAX_ROWS);
    renderRows(rows, isFirst);
    countTextEl.textContent = `${rows.length} on the board`;
    lastGoodAt = Date.now();
    updateStatusText();
  } catch (err) {
    // A leaderboard that silently stops updating is worse than one that says
    // so — this is the one thing staff at the stand can actually notice and
    // act on (refresh the laptop) without needing the admin page.
    updatedTextEl.textContent = 'Refresh failed — retrying…';
    console.error('leaderboard refresh failed', err);
  }
}

applyThemeVars();
byId<HTMLElement>('wordmark').textContent = theme.wordmark;

const brandEl = byId<HTMLElement>('brand');
if (theme.brand) {
  brandEl.textContent = theme.brand;
} else {
  brandEl.remove();
}

void refresh(true);
setInterval(() => void refresh(false), REFRESH_MS);
setInterval(updateStatusText, 1000);
