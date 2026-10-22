/**
 * Opportunity Gateway 2 — Favorites page logic (Agent B)
 * Manages the user's shortlisted opportunities stored in LocalStorage,
 * updates counts, handles unsave operations with instant UI sync,
 * and maintains resilient fallbacks for empty or corrupted storage states.
 */

import { loadOpportunities, getAllOpportunitiesMap } from './data.js';
import {
  getLang, setLang, t, loc, applyStaticTranslations, formatNumber
} from './i18n.js';
import {
  $, readSavedIds, writeSavedIds, announce, getIcon,
  buildOpportunityCard, updateNavBookmarkCount,
  setupMobileNav, setupOfflineBanner
} from './common.js';

let allOpportunities = [];
let opportunitiesMap = new Map();
let savedIds = new Set();

function formatFavoritesCountText(count, lang = getLang()) {
  if (lang === 'ar') {
    if (count === 1) return 'فرصة واحدة محفوظة';
    if (count === 2) return 'فرصتان محفوظتان';
    if (count >= 3 && count <= 10) return `${formatNumber(count, lang)} فرص محفوظة`;
    return `${formatNumber(count, lang)} فرصة محفوظة`;
  }
  return `${formatNumber(count, lang)} saved ${count === 1 ? 'opportunity' : 'opportunities'}`;
}

function renderFavorites() {
  const grid = $('#favorites-grid');
  const countBadge = $('#favorites-count');
  if (!grid) return;

  grid.innerHTML = '';
  const savedList = allOpportunities.filter(o => savedIds.has(o.id));

  // Update counts
  if (countBadge) countBadge.textContent = formatNumber(savedList.length, getLang());
  updateNavBookmarkCount(savedList.length);

  if (savedList.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${getIcon('bookmark', 34)}</div>
        <h2>${t('مكانٌ لفرصك المفضلة', 'Your shortlist is empty')}</h2>
        <p>${t('احفظ الفرص التي تلفت انتباهك أثناء التصفح، وستجدها هنا في متصفحك لتراجعها وتقدّم إليها عندما تكون جاهزًا.', 'Save opportunities that catch your eye while browsing. They will be stored here in your browser whenever you are ready.')}</p>
        <a class="btn btn-primary" href="index.html">
          <span>${t('استكشف الفرص المتاحة', 'Explore opportunities')}</span>
          ${getIcon('arrow', 18)}
        </a>
      </div>
    `;
    return;
  }

  savedList.forEach(opp => {
    const card = buildOpportunityCard(opp, true, handleUnsave);
    grid.appendChild(card);
  });
}

function handleUnsave(opp) {
  const id = opp.id;
  savedIds.delete(id);
  writeSavedIds(savedIds);

  announce(t('أُزيلت الفرصة من مفضلتك', 'Opportunity removed from your shortlist'));
  renderFavorites();
}

async function init() {
  setupMobileNav();
  setupOfflineBanner();
  applyStaticTranslations();

  try {
    allOpportunities = await loadOpportunities();
    opportunitiesMap = await getAllOpportunitiesMap();
    savedIds = readSavedIds(opportunitiesMap);

    renderFavorites();

    // Language switcher
    $('#language-button')?.addEventListener('click', () => {
      const nextLang = (getLang() === 'ar') ? 'en' : 'ar';
      setLang(nextLang);
      applyStaticTranslations();
      renderFavorites();
      announce(nextLang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
    });

    // Cross-tab storage updates
    window.addEventListener('storage', (e) => {
      if (e.key === 'opportunity-gateway2:saved:v1') {
        savedIds = readSavedIds(opportunitiesMap);
        renderFavorites();
      }
    });
  } catch (err) {
    console.error('Favorites initialization error:', err);
    const grid = $('#favorites-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <h2>${t('تعذر قراءة قائمة المفضلة', 'Unable to load saved list')}</h2>
          <p>${t('يرجى التحقق من إعدادات المتصفح وإعادة المحاولة.', 'Please check browser settings and try again.')}</p>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
