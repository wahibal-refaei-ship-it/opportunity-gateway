/**
 * Shared utility module
 * Provides safe DOM creation, secure HTTPS URL validation, resilient LocalStorage
 * management, UI icon generation, and shared opportunity card rendering.
 */

import { getLang, loc, t, formatLevels, formatDeadlineSummary, getTypeName } from './i18n.js';

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export const STORAGE_KEY_SAVED = 'opportunity-gateway2:saved:v1';
let storageOperational = true;

/**
 * Escapes characters for safe HTML embedding where textContent cannot be used.
 */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

/**
 * Validates and normalizes HTTPS URLs.
 * Rejects non-HTTPS protocols (http, javascript, data, file) and URLs containing
 * embedded user credentials (username/password).
 */
export function safeHTTPSUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) return null;
  const trimmed = urlString.trim();
  if (/[\s\\]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
      return null;
    }
    return parsed.href;
  } catch (_) {
    return null;
  }
}

/**
 * Extracts a safe hostname for display without www prefix.
 */
export function getSafeHostname(urlString) {
  const safe = safeHTTPSUrl(urlString);
  if (!safe) return '';
  try {
    return new URL(safe).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

/**
 * Safely reads saved opportunity IDs from LocalStorage.
 * Returns a Set of IDs. Gracefully handles corrupted JSON or disabled storage.
 */
export function readSavedIds(validIdsMap = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const filtered = parsed.filter(id => typeof id === 'string' && (!validIdsMap || validIdsMap.has(id)));
    return new Set(filtered);
  } catch (_) {
    storageOperational = false;
    return new Set();
  }
}

/**
 * Safely writes saved IDs to LocalStorage.
 * Returns boolean indicating persistence success.
 */
export function writeSavedIds(savedSet) {
  try {
    const array = [...savedSet];
    localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(array));
    storageOperational = true;
    return true;
  } catch (_) {
    storageOperational = false;
    return false;
  }
}

let toastTimeout = 0;
export function announce(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toast.hidden = false;
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3200);
}

/**
 * Returns inline SVG markup for system icons.
 */
export function getIcon(name, size = 18, filled = false) {
  const paths = {
    bookmark: `<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"${filled ? ' fill="currentColor"' : ''}/>`,
    arrow: `<path d="M19 12H5m7-7-7 7 7 7"/>`,
    'map-pin': `<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>`,
    globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>`,
    cap: `<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v6c4 3 8 3 12 0v-6m4-2v8"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
    book: `<path d="M12 5v15M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2V4Z"/>`,
    check: `<path d="m5 12 4 4L19 6"/>`,
    link: `<path d="M14 3h7v7m-1-6-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>`,
    search: `<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>`,
    x: `<path d="m6 6 12 12M18 6 6 18"/>`,
    menu: `<path d="M4 6h16M4 12h16M4 18h16"/>`,
    filter: `<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>`
  };
  const body = paths[name] || paths.info;
  return `<svg class="icon${name === 'arrow' ? ' flow-arrow' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * Updates bookmark counter badge in header nav.
 */
export function updateNavBookmarkCount(count) {
  const badge = document.getElementById('saved-count');
  if (badge) {
    badge.textContent = count;
    badge.setAttribute('aria-label', t(`${count} فرص محفوظة`, `${count} saved opportunities`));
  }
}

/**
 * Synchronizes all bookmark buttons across the current page for an opportunity ID.
 */
export function syncBookmarkButtons(id, isSaved, title) {
  const buttons = document.querySelectorAll(`[data-save="${id}"]`);
  const label = (isSaved
    ? t('إزالة من المفضلة: ', 'Remove from saved: ')
    : t('حفظ في المفضلة: ', 'Save opportunity: ')) + title;

  buttons.forEach(btn => {
    const isFull = btn.dataset.saveFull === 'true';
    btn.classList.toggle('is-saved', isSaved);
    btn.setAttribute('aria-pressed', String(isSaved));
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);

    btn.innerHTML = getIcon('bookmark', isFull ? 19 : 20, isSaved) +
      (isFull ? `<span>${isSaved ? t('محفوظة في المفضلة', 'Saved to your shortlist') : t('حفظ في المفضلة', 'Save opportunity')}</span>` : '');
  });
}

/**
 * Constructs an opportunity card element safely using the DOM API.
 * Avoids innerHTML injection for dynamic JSON values.
 */
export function buildOpportunityCard(opp, isSaved, onToggleSave) {
  const lang = getLang();
  const card = document.createElement('article');
  card.className = 'op-card';
  card.dataset.opportunity = opp.id;

  // 1. Card Top
  const cardTop = document.createElement('div');
  cardTop.className = 'card-top';

  const providerLockup = document.createElement('div');
  providerLockup.className = 'provider-lockup';

  const markSpan = document.createElement('span');
  const colorClass = opp.display?.color === 'gold' ? 'gold' : 'violet';
  markSpan.className = `provider-mark ${colorClass}`;
  markSpan.setAttribute('aria-hidden', 'true');
  markSpan.textContent = opp.display?.mark || (opp.type === 'course' ? 'COURSE' : 'SCHOLAR');

  const providerName = document.createElement('span');
  providerName.className = 'provider-name';
  providerName.textContent = loc(opp.provider);

  providerLockup.appendChild(markSpan);
  providerLockup.appendChild(providerName);

  // Bookmark Button
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = `save-button${isSaved ? ' is-saved' : ''}`;
  saveBtn.dataset.save = opp.id;
  saveBtn.setAttribute('aria-pressed', String(isSaved));
  const saveLabel = (isSaved ? t('إزالة من المفضلة: ', 'Remove from saved: ') : t('حفظ في المفضلة: ', 'Save opportunity: ')) + loc(opp.title);
  saveBtn.setAttribute('aria-label', saveLabel);
  saveBtn.setAttribute('title', saveLabel);
  saveBtn.innerHTML = getIcon('bookmark', 20, isSaved);

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleSave) onToggleSave(opp);
  });

  cardTop.appendChild(providerLockup);
  cardTop.appendChild(saveBtn);
  card.appendChild(cardTop);

  // 2. Card Labels
  const labelsRow = document.createElement('div');
  labelsRow.className = 'card-labels';

  const kindTag = document.createElement('span');
  kindTag.className = `card-kind ${colorClass}`;
  kindTag.textContent = getTypeName(opp.type, lang);
  labelsRow.appendChild(kindTag);

  if (opp.type === 'course') {
    const freeStudyTag = document.createElement('span');
    freeStudyTag.className = 'status-label';
    freeStudyTag.textContent = t('دراسة مجانية', 'Free learning');
    labelsRow.appendChild(freeStudyTag);
  } else if (opp.status === 'open') {
    const openTag = document.createElement('span');
    openTag.className = 'status-label';
    openTag.textContent = opp.id === 'opp-018'
      ? t('برامج مفتوحة عند الفحص', 'Open programmes at check date')
      : t('مفتوحة عند الفحص', 'Open at check date');
    labelsRow.appendChild(openTag);
  }
  card.appendChild(labelsRow);

  // 3. Title
  const titleH3 = document.createElement('h3');
  titleH3.className = 'card-title';
  const titleA = document.createElement('a');
  titleA.href = `detail.html?id=${encodeURIComponent(opp.id)}`;
  titleA.textContent = loc(opp.title);
  titleH3.appendChild(titleA);
  card.appendChild(titleH3);

  // 4. Description / Summary
  const descP = document.createElement('p');
  descP.className = 'card-description';
  descP.textContent = loc(opp.summary) || loc(opp.description);
  card.appendChild(descP);

  // 5. Certificate (if course)
  if (opp.type === 'course' && opp.course?.certificate) {
    const certP = document.createElement('p');
    certP.className = 'card-certificate';
    certP.innerHTML = getIcon('cap', 15);
    const certText = document.createElement('span');
    certText.textContent = loc(opp.course.certificate.label);
    certP.appendChild(certText);
    card.appendChild(certP);
  }

  // 6. Meta (location, level)
  const metaDiv = document.createElement('div');
  metaDiv.className = 'card-meta';

  const locItem = document.createElement('span');
  locItem.className = 'meta-item';
  locItem.innerHTML = getIcon(opp.type === 'course' ? 'globe' : 'map-pin', 16);
  const locText = document.createElement('span');
  locText.textContent = loc(opp.country);
  locItem.appendChild(locText);
  metaDiv.appendChild(locItem);

  const levelItem = document.createElement('span');
  levelItem.className = 'meta-item';
  levelItem.innerHTML = getIcon('cap', 16);
  const levelText = document.createElement('span');
  levelText.textContent = formatLevels(opp.levels, lang);
  levelItem.appendChild(levelText);
  metaDiv.appendChild(levelItem);

  card.appendChild(metaDiv);

  // 7. Verification note (automated check date)
  const verifP = document.createElement('p');
  verifP.className = 'card-verification';
  verifP.innerHTML = getIcon('info', 14);
  const verifText = document.createElement('span');
  verifText.textContent = t(
    `فحص مصدر آلي: ${opp.verified_at}. المراجعة البشرية معلّقة.`,
    `Automated source check: ${opp.verified_at}. Human review pending.`
  );
  verifP.appendChild(verifText);
  card.appendChild(verifP);

  // 8. Card Footer
  const footerDiv = document.createElement('div');
  footerDiv.className = 'card-footer';

  const deadlineSummary = formatDeadlineSummary(opp.deadline, lang);
  const deadlineLabel = document.createElement('span');
  deadlineLabel.className = 'deadline-label';
  deadlineLabel.innerHTML = getIcon('clock', 14);
  const deadlineText = document.createElement('span');
  deadlineText.textContent = deadlineSummary.text;
  if (deadlineSummary.isUrgent) {
    deadlineText.className = 'deadline-badge-urgent';
  }
  deadlineLabel.appendChild(deadlineText);
  footerDiv.appendChild(deadlineLabel);

  const detailLink = document.createElement('a');
  detailLink.className = 'detail-link';
  detailLink.href = `detail.html?id=${encodeURIComponent(opp.id)}`;
  detailLink.setAttribute('aria-label', t('تفاصيل ', 'Details for ') + loc(opp.title));
  detailLink.innerHTML = `<span>${t('التفاصيل', 'Details')}</span>${getIcon('arrow', 17)}`;
  footerDiv.appendChild(detailLink);

  card.appendChild(footerDiv);

  return card;
}

/**
 * Handles mobile hamburger navigation toggle.
 */
export function setupMobileNav() {
  const menuBtn = document.getElementById('menu-button');
  const mobileNav = document.getElementById('mobile-nav');
  if (!menuBtn || !mobileNav) return;

  menuBtn.addEventListener('click', () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;
    menuBtn.setAttribute('aria-expanded', String(nextState));
    menuBtn.setAttribute('aria-label', nextState
      ? t('إغلاق قائمة التنقل', 'Close navigation menu')
      : t('فتح قائمة التنقل', 'Open navigation menu'));
    mobileNav.hidden = !nextState;
    mobileNav.classList.toggle('is-open', nextState);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      menuBtn.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
      mobileNav.classList.remove('is-open');
      menuBtn.focus();
    }
  });
}

/**
 * Sets up the offline detection banner.
 */
export function setupOfflineBanner() {
  registerServiceWorker();
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  function update() {
    const isOffline = !navigator.onLine;
    banner.hidden = !isOffline;
    banner.classList.toggle('hidden', !isOffline);
    if (isOffline) {
      banner.textContent = t(
        'أنت دون اتصال الآن. ستحتاج إلى الإنترنت لزيارة روابط التقديم والمصادر الرسمية.',
        'You are offline. An internet connection is needed to visit official application links and external sources.'
      );
    }
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

let serviceWorkerRegistrationStarted = false;

// All four pages initialize offline support through setupOfflineBanner().
// Register even when JSON loading or navigation has already passed window.load.
function registerServiceWorker() {
  if (serviceWorkerRegistrationStarted || !('serviceWorker' in navigator)) return;
  serviceWorkerRegistrationStarted = true;

  const register = () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(registration => {
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              announce(t('تحديث متاح للمشروع. أعد التحميل لتطبيقه.', 'Update available. Reload to refresh.'));
            }
          };
        };
      })
      .catch(() => {
        // The online app remains usable if registration is unavailable.
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
