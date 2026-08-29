import { applyBrandText, applyThemeVars } from '../theme/cssVars.ts';
import { fetchLeaderboard } from './data.ts';
import type { LeaderboardRow } from './types.ts';

const REFRESH_MS = 15_000;
const MAX_ROWS = 50;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`leaderboard.html is missing #${id}`);
  return el as T;
}

const rowsEl = byId<HTMLTableSectionElement>('rows');
const countTextEl = byId<HTMLElement>('count-text');

let previousByKey = new Map<string, LeaderboardRow>();

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

/** Escapes free text before it goes into innerHTML. */
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
      tr.style.animationDelay = `${Math.min(i, 20) * 35}ms`;
    } else {
      // Only changed rows animate on a refresh, so a real shakeup draws the eye.
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

async function refresh(isFirst: boolean): Promise<void> {
  if (isFirst) renderSkeleton();
  try {
    const rows = await fetchLeaderboard(MAX_ROWS);
    renderRows(rows, isFirst);
    countTextEl.textContent = `${rows.length} on the board`;
  } catch (err) {
    console.error('leaderboard refresh failed', err);
  }
}

applyThemeVars();
applyBrandText();

byId<HTMLButtonElement>('play-nav').addEventListener('click', () => {
  window.location.href = 'register.html';
});

void refresh(true);
setInterval(() => void refresh(false), REFRESH_MS);
