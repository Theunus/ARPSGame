/** Registration form and returning-player status view for register.html. */
import { ApiError, register } from '../api.ts';
import { clearSession, loadSession, nextToken, saveSession } from '../session.ts';
import { applyBrandText, applyThemeVars } from '../theme/cssVars.ts';
import { isValidSaPhone } from '../validation.ts';

const CONSENT_VERSION = 'arps-v1';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`register.html is missing #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>('form');
const statusView = byId<HTMLDivElement>('status');
const formError = byId<HTMLDivElement>('formError');
const submitButton = byId<HTMLButtonElement>('submitButton');
const statusName = byId<HTMLElement>('statusName');
const statusAttempts = byId<HTMLElement>('statusAttempts');
const exhaustedNote = byId<HTMLElement>('exhaustedNote');
const playButton = byId<HTMLButtonElement>('playButton');
const leaderboardButton = byId<HTMLButtonElement>('leaderboardButton');
const notYouLink = byId<HTMLAnchorElement>('notYouLink');

function showForm(): void {
  form.hidden = false;
  statusView.hidden = true;
}

function showStatus(displayName: string, attemptsRemaining: number): void {
  form.hidden = true;
  statusView.hidden = false;
  statusName.textContent = displayName;

  const hasAttempts = attemptsRemaining > 0;
  playButton.hidden = !hasAttempts;
  exhaustedNote.hidden = hasAttempts;
  statusAttempts.textContent = hasAttempts
    ? `${attemptsRemaining} of 3 attempts remaining`
    : '';
}

function setSubmitting(submitting: boolean): void {
  submitButton.disabled = submitting;
  submitButton.textContent = submitting ? 'Registering…' : 'Register & Play';
}

function showError(message: string): void {
  formError.textContent = message;
  formError.style.display = 'block';
}

function clearError(): void {
  formError.style.display = 'none';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const fullName = byId<HTMLInputElement>('fullName').value.trim();
  const email = byId<HTMLInputElement>('email').value.trim();
  const phone = byId<HTMLInputElement>('phone').value.trim();
  const consentCompetition = byId<HTMLInputElement>('consentCompetition').checked;

  if (!consentCompetition) {
    showError('Please tick the box to confirm you agree and are 18 or older.');
    return;
  }

  if (phone && !isValidSaPhone(phone)) {
    showError('Enter a valid South African phone number, e.g. 082 123 4567 — or leave it blank.');
    return;
  }

  setSubmitting(true);
  try {
    const res = await register({
      fullName,
      email,
      phone: phone || undefined,
      consentCompetition,
      isAdult: consentCompetition,
      consentVersion: CONSENT_VERSION,
    });

    saveSession({
      displayName: res.displayName,
      attemptsTotal: res.attemptsTotal,
      tokens: res.tokens,
    });

    if (res.attemptsRemaining > 0) {
      window.location.href = 'index.html';
    } else {
      showStatus(res.displayName, 0);
    }
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.status === 0
          ? "Couldn't reach the server — check your connection and try again."
          : err.message
        : 'Something went wrong. Please try again.';
    showError(message);
  } finally {
    setSubmitting(false);
  }
});

playButton.addEventListener('click', () => {
  window.location.href = 'index.html';
});

leaderboardButton.addEventListener('click', () => {
  window.location.href = 'leaderboard.html';
});

notYouLink.addEventListener('click', (e) => {
  e.preventDefault();
  clearSession();
  form.reset();
  showForm();
});

applyThemeVars();
applyBrandText();

const cached = loadSession();
if (cached) {
  showStatus(cached.displayName, nextToken() ? cached.tokens.length : 0);
} else {
  showForm();
}
