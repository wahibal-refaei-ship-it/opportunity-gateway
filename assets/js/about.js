/**
 * About page module (assets/js/about.js)
 * Extracted from inline script in about.html to comply with CSP (script-src 'self').
 */

import { applyStaticTranslations, getLang, setLang } from './i18n.js';
import { updateNavBookmarkCount, readSavedIds, setupMobileNav, setupOfflineBanner, announce } from './common.js';
import { getAllOpportunitiesMap } from './data.js';

async function init() {
  setupMobileNav();
  setupOfflineBanner();
  applyStaticTranslations();

  try {
    const map = await getAllOpportunitiesMap();
    const saved = readSavedIds(map);
    updateNavBookmarkCount(saved.size);
  } catch (_) {}

  document.getElementById('language-button')?.addEventListener('click', () => {
    const nextLang = (getLang() === 'ar') ? 'en' : 'ar';
    setLang(nextLang);
    applyStaticTranslations();
    announce(nextLang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
