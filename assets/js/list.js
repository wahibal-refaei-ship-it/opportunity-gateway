/**
 * Opportunity Gateway 2 — Explore & Listing page logic (Agent A)
 * Controls search with Arabic normalization, multi-layered AND filtering,
 * sorting, active chips, bookmark syncing, and card rendering.
 */

import { loadOpportunities, getAllOpportunitiesMap } from './data.js';
import {
  getLang, setLang, t, loc, applyStaticTranslations, formatNumber,
  normalizeSearchText, getTypeName, FIELD_LABELS, LOCATION_LABELS,
  LEVEL_LABELS, STATUS_LABELS
} from './i18n.js';
import {
  $, $$, readSavedIds, writeSavedIds, announce, getIcon,
  buildOpportunityCard, syncBookmarkButtons, updateNavBookmarkCount,
  setupMobileNav, setupOfflineBanner
} from './common.js';

const AS_OF_DATE = '2026-10-21';

let allOpportunities = [];
let opportunitiesMap = new Map();

const state = {
  query: '',
  kind: 'all',          // 'all' | 'scholarship' | 'course'
  field: 'all',
  place: 'all',
  level: 'all',
  status: 'all',
  deadlineRange: 'all', // 'all' | '14_days' | '30_days'
  courseLang: 'all',    // 'all' | 'ar' | 'en'
  freeCertOnly: false,
  sort: 'recommended',
  saved: new Set(),
  filtersOpen: false
};

let searchDebounceTimer = 0;

function daysUntilDeadline(closesAt) {
  if (!closesAt) return null;
  const asOf = new Date(AS_OF_DATE + 'T00:00:00Z');
  const target = new Date(closesAt + 'T00:00:00Z');
  return Math.round((target.getTime() - asOf.getTime()) / 86400000);
}

function filterOpportunities() {
  const words = normalizeSearchText(state.query).split(' ').filter(Boolean);

  return allOpportunities.filter(item => {
    // 1. Search Query (AND logic across all words)
    if (words.length > 0) {
      const matchAll = words.every(word => item._searchIndex.includes(word));
      if (!matchAll) return false;
    }

    // 2. Kind / Type (Only 'scholarship' and 'course')
    if (state.kind !== 'all' && item.type !== state.kind) {
      return false;
    }

    // 3. Field / Category
    if (state.field !== 'all') {
      if (state.field === 'technology') {
        const isTech = item.type === 'course' ||
          (item.fields && item.fields.some(f => /technology|comput|ai|data|engineering/i.test(f)));
        if (!isTech) return false;
      } else if (state.field === 'business') {
        const isBiz = item.fields && item.fields.some(f => /business|management|admin/i.test(f));
        if (!isBiz) return false;
      } else if (state.field === 'general') {
        const isGen = item.fields && item.fields.some(f => /multiple|general/i.test(f));
        if (!isGen) return false;
      }
    }

    // 4. Place / Location
    if (state.place !== 'all') {
      if (state.place === 'online') {
        const isOnline = item.type === 'course' || item.country?.en === 'Online' || item.country?.ar?.includes('الإنترنت');
        if (!isOnline) return false;
      } else if (state.place === 'abroad') {
        const isAbroad = item.type === 'scholarship' && item.id !== 'opp-018';
        if (!isAbroad) return false;
      } else if (state.place === 'mixed') {
        const isMixed = item.id === 'opp-018';
        if (!isMixed) return false;
      }
    }

    // 5. Level
    if (state.level !== 'all') {
      if (!item.levels || !item.levels.includes(state.level)) {
        return false;
      }
    }

    // 6. Status
    if (state.status !== 'all') {
      if (item.status !== state.status) {
        return false;
      }
    }

    // 7. Deadline Range (Fixed deadlines only; past deadlines excluded)
    if (state.deadlineRange !== 'all') {
      if (item.deadline?.type !== 'fixed' || !item.deadline?.closes_at) {
        return false;
      }
      const days = daysUntilDeadline(item.deadline.closes_at);
      if (days === null || days < 0) return false;

      if (state.deadlineRange === '14_days' && days > 14) return false;
      if (state.deadlineRange === '30_days' && days > 30) return false;
    }

    // 8. Course-specific filters (Active only when courses are in scope)
    if (state.kind !== 'scholarship') {
      if (state.courseLang !== 'all') {
        if (item.type !== 'course') return false;
        if (!item.course?.content_languages?.includes(state.courseLang)) return false;
      }
      if (state.freeCertOnly) {
        if (item.type !== 'course') return false;
        if (item.course?.certificate?.status !== 'free') return false;
      }
    }

    return true;
  });
}

function sortOpportunities(list) {
  const lang = getLang();
  const sorted = [...list];

  if (state.sort === 'title') {
    sorted.sort((a, b) => loc(a.title).localeCompare(loc(b.title), lang));
  } else if (state.sort === 'verified') {
    sorted.sort((a, b) => (b.verified_at || '').localeCompare(a.verified_at || ''));
  } else if (state.sort === 'deadline') {
    sorted.sort((a, b) => {
      const aFixed = a.deadline?.type === 'fixed' && a.deadline?.closes_at;
      const bFixed = b.deadline?.type === 'fixed' && b.deadline?.closes_at;

      if (aFixed && bFixed) {
        return a.deadline.closes_at.localeCompare(b.deadline.closes_at);
      }
      if (aFixed && !bFixed) return -1;
      if (!aFixed && bFixed) return 1;
      return 0;
    });
  }
  return sorted;
}

function renderResults() {
  const filtered = filterOpportunities();
  const sorted = sortOpportunities(filtered);
  const grid = $('#results-grid');
  const countEl = $('#results-count');

  if (!grid || !countEl) return;

  grid.innerHTML = '';

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">${getIcon('search', 32)}</div>
      <h3>${t('لم نجد فرصًا تطابق خياراتك', 'No opportunities match your criteria')}</h3>
      <p>${t('جرّب تغيير كلمات البحث أو إعادة ضبط بعض الفلاتر لاستكشاف المزيد من المنح والدورات.', 'Try a different keyword or reset some filters to explore more opportunities.')}</p>
      <button class="btn btn-secondary" type="button" id="empty-reset-btn">${t('إعادة ضبط جميع الفلاتر', 'Reset all filters')}</button>
    `;
    empty.querySelector('#empty-reset-btn')?.addEventListener('click', resetAllFilters);
    grid.appendChild(empty);
  } else {
    sorted.forEach(item => {
      const isSaved = state.saved.has(item.id);
      const card = buildOpportunityCard(item, isSaved, handleToggleSave);
      grid.appendChild(card);
    });
  }

  // Results count
  const lang = getLang();
  countEl.textContent = t(
    `يعرض ${formatNumber(sorted.length, lang)} من أصل ${formatNumber(allOpportunities.length, lang)} فرصة`,
    `Showing ${formatNumber(sorted.length, lang)} of ${formatNumber(allOpportunities.length, lang)} opportunities`
  );

  syncControls();
  renderActiveChips();
}

function syncControls() {
  const searchInput = $('#search-input');
  if (searchInput && searchInput.value !== state.query) {
    searchInput.value = state.query;
  }

  const selects = [
    ['field-filter', state.field],
    ['place-filter', state.place],
    ['level-filter', state.level],
    ['status-filter', state.status],
    ['deadline-filter', state.deadlineRange],
    ['course-lang-filter', state.courseLang],
    ['sort-select', state.sort]
  ];

  selects.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  const freeCertBox = document.getElementById('free-cert-filter');
  if (freeCertBox) freeCertBox.checked = state.freeCertOnly;

  // Toggle Category Tabs
  $$('.category-tab').forEach(tab => {
    const active = tab.dataset.kind === state.kind;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });

  // Course-specific controls visibility
  const courseSection = $('#course-filter-group');
  const certWrapper = $('#free-cert-wrapper');
  const isScholarshipSelected = state.kind === 'scholarship';

  if (courseSection) {
    courseSection.style.display = isScholarshipSelected ? 'none' : 'block';
  }
  if (certWrapper) {
    certWrapper.style.display = isScholarshipSelected ? 'none' : 'flex';
  }
}

function renderActiveChips() {
  const container = $('#active-filters');
  if (!container) return;

  container.innerHTML = '';
  const chips = [];

  if (state.query) {
    chips.push({ key: 'query', label: `${t('بحث: ', 'Search: ')}"${state.query}"` });
  }
  if (state.kind !== 'all') {
    chips.push({ key: 'kind', label: getTypeName(state.kind, getLang()) });
  }
  if (state.field !== 'all') {
    chips.push({ key: 'field', label: FIELD_LABELS[state.field]?.[getLang()] || state.field });
  }
  if (state.place !== 'all') {
    chips.push({ key: 'place', label: LOCATION_LABELS[state.place]?.[getLang()] || state.place });
  }
  if (state.level !== 'all') {
    chips.push({ key: 'level', label: LEVEL_LABELS[state.level]?.[getLang()] || state.level });
  }
  if (state.status !== 'all') {
    chips.push({ key: 'status', label: STATUS_LABELS[state.status]?.[getLang()] || state.status });
  }
  if (state.deadlineRange !== 'all') {
    chips.push({
      key: 'deadlineRange',
      label: state.deadlineRange === '14_days' ? t('خلال 14 يومًا', 'Within 14 days') : t('خلال 30 يومًا', 'Within 30 days')
    });
  }
  if (state.kind !== 'scholarship') {
    if (state.courseLang !== 'all') {
      chips.push({
        key: 'courseLang',
        label: state.courseLang === 'ar' ? t('محتوى بالعربية', 'Arabic content') : t('محتوى بالإنجليزية', 'English content')
      });
    }
    if (state.freeCertOnly) {
      chips.push({ key: 'freeCertOnly', label: t('شهادة مجانية مثبتة', 'Free certificate') });
    }
  }

  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'active-filter';
    btn.setAttribute('aria-label', `${t('إزالة الفلتر: ', 'Remove filter: ')}${chip.label}`);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = chip.label;
    btn.appendChild(labelSpan);

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.innerHTML = getIcon('x', 14);
    btn.appendChild(iconSpan);

    btn.addEventListener('click', () => {
      removeFilter(chip.key);
    });

    container.appendChild(btn);
  });

  container.hidden = chips.length === 0;
}

function removeFilter(key) {
  if (key === 'query') state.query = '';
  else if (key === 'kind') state.kind = 'all';
  else if (key === 'field') state.field = 'all';
  else if (key === 'place') state.place = 'all';
  else if (key === 'level') state.level = 'all';
  else if (key === 'status') state.status = 'all';
  else if (key === 'deadlineRange') state.deadlineRange = 'all';
  else if (key === 'courseLang') state.courseLang = 'all';
  else if (key === 'freeCertOnly') state.freeCertOnly = false;

  renderResults();
  announce(t('تم تحديث الفلاتر', 'Filters updated'));
}

function resetAllFilters() {
  state.query = '';
  state.kind = 'all';
  state.field = 'all';
  state.place = 'all';
  state.level = 'all';
  state.status = 'all';
  state.deadlineRange = 'all';
  state.courseLang = 'all';
  state.freeCertOnly = false;
  state.sort = 'recommended';

  renderResults();
  announce(t('تمت إعادة ضبط جميع الفلاتر', 'All filters reset'));
}

function handleToggleSave(item) {
  const id = item.id;
  const isAdding = !state.saved.has(id);

  if (isAdding) {
    state.saved.add(id);
  } else {
    state.saved.delete(id);
  }

  const persisted = writeSavedIds(state.saved);
  syncBookmarkButtons(id, isAdding, loc(item.title));
  updateNavBookmarkCount(state.saved.size);

  if (isAdding) {
    announce(persisted
      ? t('أُضيفت الفرصة إلى مفضلتك', 'Opportunity added to your shortlist')
      : t('حُفظت الفرصة مؤقتًا لهذه الجلسة', 'Saved for this session only')
    );
  } else {
    announce(t('أُزيلت الفرصة من مفضلتك', 'Opportunity removed from your shortlist'));
  }
}

function setupEventListeners() {
  // Search form and input
  const searchForm = $('#search-form');
  const searchInput = $('#search-input');

  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchDebounceTimer);
    state.query = (searchInput?.value || '').trim();
    renderResults();
    $('#opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    state.query = e.target.value;
    searchDebounceTimer = window.setTimeout(renderResults, 150);
  });

  // Header CTA button
  $('#header-search-cta')?.addEventListener('click', () => {
    searchInput?.focus();
    searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Pathway clicks
  $$('[data-pathway-kind]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.pathwayKind;
      if (kind === 'scholarship' || kind === 'course') {
        state.kind = kind;
        renderResults();
        $('#opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Category Tabs
  $$('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const kind = tab.dataset.kind;
      if (['all', 'scholarship', 'course'].includes(kind)) {
        state.kind = kind;
        // When switching to scholarships, reset course-specific filters
        if (kind === 'scholarship') {
          state.courseLang = 'all';
          state.freeCertOnly = false;
        }
        renderResults();
      }
    });
  });

  // Select filters
  const filterMap = [
    ['field-filter', 'field'],
    ['place-filter', 'place'],
    ['level-filter', 'level'],
    ['status-filter', 'status'],
    ['deadline-filter', 'deadlineRange'],
    ['course-lang-filter', 'courseLang'],
    ['sort-select', 'sort']
  ];

  filterMap.forEach(([id, key]) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', (e) => {
      state[key] = e.target.value;
      renderResults();
    });
  });

  // Free Certificate Checkbox
  $('#free-cert-filter')?.addEventListener('change', (e) => {
    state.freeCertOnly = e.target.checked;
    renderResults();
  });

  // Clear filters button
  $('#clear-filters')?.addEventListener('click', resetAllFilters);

  // Mobile Filter Drawer Toggle
  $('#filter-toggle')?.addEventListener('click', () => {
    state.filtersOpen = !state.filtersOpen;
    const filters = $('#filters');
    filters?.classList.toggle('is-open', state.filtersOpen);
    $('#filter-toggle')?.setAttribute('aria-expanded', String(state.filtersOpen));
  });

  // Language switcher
  $('#language-button')?.addEventListener('click', () => {
    const nextLang = (getLang() === 'ar') ? 'en' : 'ar';
    setLang(nextLang);
    applyStaticTranslations();
    renderResults();
    announce(nextLang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
  });

  // Cross-tab storage updates
  window.addEventListener('storage', (e) => {
    if (e.key === 'opportunity-gateway2:saved:v1') {
      state.saved = readSavedIds(opportunitiesMap);
      updateNavBookmarkCount(state.saved.size);
      allOpportunities.forEach(opp => {
        syncBookmarkButtons(opp.id, state.saved.has(opp.id), loc(opp.title));
      });
    }
  });
}

// Initialization
async function init() {
  setupMobileNav();
  setupOfflineBanner();
  applyStaticTranslations();

  try {
    allOpportunities = await loadOpportunities();
    opportunitiesMap = await getAllOpportunitiesMap();
    state.saved = readSavedIds(opportunitiesMap);
    updateNavBookmarkCount(state.saved.size);

    setupEventListeners();
    renderResults();
  } catch (err) {
    console.error('Initialization error:', err);
    const grid = $('#results-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>${t('تعذر تحميل بيانات الفرص', 'Failed to load opportunity data')}</h3>
          <p>${t('يرجى التحقق من الاتصال وإعادة تحميل الصفحة.', 'Please check connection and reload the page.')}</p>
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
