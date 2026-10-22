(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const data = (Array.isArray(window.OPPORTUNITIES) ? window.OPPORTUNITIES : []).filter(item => item && ['scholarship', 'course'].includes(item.kind));
  const byId = new Map(data.map(item => [String(item.id), item]));
  const keys = { saved: 'opportunity-gateway2:saved:v1', lang: 'opportunity-gateway2:language' };
  let storageAvailable = true;

  function readStorage(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch (_) { storageAvailable = false; return fallback; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); storageAvailable = true; return true; }
    catch (_) { storageAvailable = false; return false; }
  }
  let initialSaved = [];
  try {
    const value = JSON.parse(readStorage(keys.saved, '[]'));
    initialSaved = Array.isArray(value) ? value.filter(id => byId.has(String(id))).map(String) : [];
  } catch (_) { initialSaved = []; }

  const state = {
    lang: readStorage(keys.lang, 'ar') === 'en' ? 'en' : 'ar',
    page: 'explore', detailId: '', query: '', kind: 'all', field: 'all', place: 'all',
    sort: 'recommended', saved: new Set(initialSaved), menuOpen: false, filtersOpen: false
  };
  const scrollPositions = new Map();
  let currentRoute = '';
  let toastTimer = 0;
  let searchTimer = 0;

  const T = (ar, en) => state.lang === 'ar' ? ar : en;
  const L = value => {
    if (value == null) return '';
    if (typeof value === 'object') return String(value[state.lang] ?? value.ar ?? value.en ?? '');
    return String(value);
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const number = value => new Intl.NumberFormat(state.lang === 'ar' ? 'ar' : 'en').format(value);
  const normalize = value => String(value ?? '').normalize('NFKD').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  const kindName = kind => ({ course: T('دورة مجانية', 'Free course'), scholarship: T('منحة دراسية', 'Scholarship') })[kind] || T('فرصة', 'Opportunity');
  const fieldName = field => ({ technology: T('تقنية وحاسوب', 'Technology'), business: T('إدارة وأعمال', 'Business'), general: T('تخصصات متعددة', 'Multiple fields') })[field] || '';
  const placeName = place => ({ online: T('عن بُعد', 'Online'), abroad: T('خارج اليمن', 'Abroad'), mixed: T('بحسب البرنامج', 'Varies by programme') })[place] || '';
  const typeName = item => item.displayType ? L(item.displayType) : kindName(item.kind);

  function icon(name, size = 20, filled = false) {
    const paths = {
      bookmark: `<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"${filled ? ' fill="currentColor"' : ''}/>`,
      arrow: state.lang === 'ar' ? '<path d="M19 12H5m6-6-6 6 6 6"/>' : '<path d="M5 12h14m-6-6 6 6-6 6"/>',
      'map-pin': '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
      cap: '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v6c4 3 8 3 12 0v-6m4-2v8"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      book: '<path d="M12 5v15M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2V4Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      link: '<path d="M14 3h7v7m-1-6-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
      search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
      x: '<path d="m6 6 12 12M18 6 6 18"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.book}</svg>`;
  }

  function sourceInfo(item) {
    try {
      const url = new URL(item.source);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsupported source');
      return { url: url.href, host: url.hostname.replace(/^www\./, '') };
    } catch (_) { return { url: '', host: '' }; }
  }
  function applicationInfo(item) {
    try {
      if (typeof item.applicationUrl !== 'string' || !item.applicationUrl.trim()) return { url: '', host: '' };
      const url = new URL(item.applicationUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsupported application URL');
      return { url: url.href, host: url.hostname.replace(/^www\./, '') };
    } catch (_) { return { url: '', host: '' }; }
  }
  function announce(message) {
    const toast = $('#toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.classList.remove('is-visible'); }, 3200);
  }

  function saveButton(item, full = false) {
    const saved = state.saved.has(String(item.id));
    const label = saved ? T('إزالة من المفضلة: ', 'Remove from saved: ') : T('حفظ في المفضلة: ', 'Save opportunity: ');
    return `<button type="button" class="${full ? 'btn btn-secondary full save-full' : 'save-button'}${saved ? ' is-saved' : ''}" data-save="${esc(item.id)}"${full ? ' data-save-full="true"' : ''} aria-pressed="${saved}" aria-label="${esc(label + L(item.title))}" title="${esc(label + L(item.title))}">${icon('bookmark', full ? 19 : 20, saved)}${full ? `<span>${saved ? T('محفوظة في المفضلة', 'Saved to your shortlist') : T('حفظ في المفضلة', 'Save opportunity')}</span>` : ''}</button>`;
  }

  function card(item) {
    const href = `#detail/${encodeURIComponent(item.id)}`;
    const color = item.kind === 'course' ? 'gold' : 'violet';
    const status = L(item.statusLabel);
    const certificate = L(item.certificateLabel);
    const verification = L(item.verificationLabel);
    return `<article class="op-card" data-opportunity="${esc(item.id)}">
      <div class="card-top"><div class="provider-lockup"><span class="provider-mark ${color}" aria-hidden="true">${esc(item.mark || 'OG')}</span><span class="provider-name">${esc(L(item.provider))}</span></div>${saveButton(item)}</div>
      <div class="card-labels"><span class="card-kind ${color}">${esc(typeName(item))}</span>${status ? `<span class="status-label">${esc(status)}</span>` : ''}</div>
      <h3 class="card-title"><a href="${href}">${esc(L(item.title))}</a></h3>
      <p class="card-description">${esc(L(item.summary))}</p>
      ${certificate ? `<p class="card-certificate">${icon('cap', 15)}<span>${esc(certificate)}</span></p>` : ''}
      <div class="card-meta"><span class="meta-item">${icon(item.place === 'online' ? 'globe' : 'map-pin', 16)}${esc(L(item.location) || placeName(item.place))}</span><span class="meta-item">${icon('cap', 16)}${esc(L(item.level))}</span></div>
      ${verification ? `<p class="card-verification">${icon('info', 14)}<span>${esc(verification)}</span></p>` : ''}
      <div class="card-footer"><span class="deadline-label">${icon('clock', 15)}<span>${esc(L(item.deadlineLabel))}</span></span><a class="detail-link" href="${href}" aria-label="${esc(T('تفاصيل ', 'Details for ') + L(item.title))}">${T('التفاصيل', 'Details')}${icon('arrow', 17)}</a></div>
    </article>`;
  }

  function filtered() {
    const words = normalize(state.query).split(' ').filter(Boolean);
    const result = data.filter(item => {
      const haystack = normalize([item.title?.ar, item.title?.en, item.provider?.ar, item.provider?.en, item.location?.ar, item.location?.en, item.summary?.ar, item.summary?.en, item.field, fieldName(item.field), kindName(item.kind), item.mark].join(' '));
      return (state.kind === 'all' || item.kind === state.kind) &&
        (state.field === 'all' || item.field === state.field) &&
        (state.place === 'all' || item.place === state.place) &&
        words.every(word => haystack.includes(word));
    });
    if (state.sort === 'title') result.sort((a, b) => L(a.title).localeCompare(L(b.title), state.lang));
    else if (state.sort === 'type') result.sort((a, b) => typeName(a).localeCompare(typeName(b), state.lang));
    return result;
  }

  function emptyState(kind) {
    if (kind === 'saved') return `<div class="empty-state"><div class="empty-icon">${icon('bookmark', 34)}</div><h2>${T('مكانٌ لفرصك المفضلة', 'Make room for your next possibility')}</h2><p>${T('احفظ الفرص التي تلفت انتباهك، وستجدها هنا عندما تكون مستعدًا للخطوة التالية.', 'Save opportunities that catch your eye. They will be here when you are ready for your next step.')}</p><a class="btn btn-primary" href="#explore" data-page="explore">${T('استكشف الفرص', 'Explore opportunities')}${icon('arrow', 18)}</a></div>`;
    if (kind === 'detail') return `<div class="empty-state"><div class="empty-icon">${icon('search', 34)}</div><h1>${T('لم نعثر على هذه الفرصة', 'This opportunity could not be found')}</h1><p>${T('قد يكون الرابط غير مكتمل. يمكنك العودة إلى القائمة واختيار فرصة أخرى.', 'The link may be incomplete. Return to the collection and choose another opportunity.')}</p><a class="btn btn-primary" href="#explore" data-page="explore">${T('العودة إلى الفرص', 'Back to opportunities')}${icon('arrow', 18)}</a></div>`;
    return `<div class="empty-state"><div class="empty-icon">${icon('search', 34)}</div><h3>${T('لم نجد فرصًا تطابق بحثك', 'No opportunities match your search')}</h3><p>${T('جرّب كلمة أقصر أو وسّع خيارات التصفية لاستكشاف المزيد.', 'Try a shorter keyword or broaden your filters to explore more possibilities.')}</p><button class="btn btn-secondary" type="button" data-action="reset-filters">${T('مسح البحث والفلاتر', 'Clear search and filters')}</button></div>`;
  }

  function renderActiveFilters() {
    const host = $('#active-filters');
    if (!host) return;
    const chips = [];
    if (state.query) chips.push(['query', T('بحث: ', 'Search: ') + state.query]);
    if (state.kind !== 'all') chips.push(['kind', kindName(state.kind)]);
    if (state.field !== 'all') chips.push(['field', fieldName(state.field)]);
    if (state.place !== 'all') chips.push(['place', placeName(state.place)]);
    host.innerHTML = chips.map(([key, label]) => `<button type="button" class="active-filter" data-remove-filter="${key}" aria-label="${esc(T('إزالة الفلتر: ', 'Remove filter: ') + label)}">${esc(label)}${icon('x', 14)}</button>`).join('');
    host.hidden = !chips.length;
  }

  function syncControls() {
    const input = $('#search-input');
    if (input && input.value !== state.query) input.value = state.query;
    [['field-filter', 'field'], ['place-filter', 'place'], ['sort-select', 'sort']].forEach(([id, key]) => {
      const control = $('#' + id);
      if (control) control.value = state[key];
    });
    $$('[data-kind]').forEach(button => {
      const active = button.dataset.kind === state.kind;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderResults() {
    const result = filtered();
    const grid = $('#results-grid');
    if (grid) grid.innerHTML = result.length ? result.map(card).join('') : emptyState('results');
    const count = $('#results-count');
    if (count) count.textContent = T(`${number(result.length)} من ${number(data.length)} فرصة`, `${number(result.length)} of ${number(data.length)} opportunities`);
    syncControls();
    renderActiveFilters();
  }

  function renderFavorites() {
    const items = data.filter(item => state.saved.has(String(item.id)));
    const host = $('#favorites-grid');
    if (host) host.innerHTML = items.length ? items.map(card).join('') : emptyState('saved');
    const count = $('#favorites-count');
    if (count) count.textContent = T(items.length === 1 ? 'فرصة واحدة محفوظة' : items.length === 2 ? 'فرصتان محفوظتان' : `${number(items.length)} ${items.length > 10 ? 'فرصة' : 'فرص'} محفوظة`, `${number(items.length)} saved opportunities`);
    const savedCount = $('#saved-count');
    if (savedCount) {
      savedCount.textContent = number(items.length);
      savedCount.setAttribute('aria-label', T(items.length === 1 ? 'فرصة واحدة محفوظة' : items.length === 2 ? 'فرصتان محفوظتان' : `${number(items.length)} ${items.length > 10 ? 'فرصة' : 'فرص'} محفوظة`, `${number(items.length)} saved opportunities`));
    }
    $$('[data-saved-count]').forEach(element => { element.textContent = number(items.length); });
  }

  function renderDetail(id) {
    const host = $('#detail-content');
    if (!host) return;
    const item = byId.get(String(id));
    if (!item) { host.innerHTML = emptyState('detail'); return; }
    const source = sourceInfo(item);
    const application = applicationInfo(item);
    const target = application.url ? application : source;
    const actionLabel = application.url
      ? (item.kind === 'course' ? T('ابدأ التعلم لدى الجهة', 'Start learning with the provider') : T('خطوات التقديم لدى الجهة', 'Application steps with the provider'))
      : T('زيارة المصدر الرسمي', 'Visit official source');
    const status = L(item.statusLabel);
    const certificate = L(item.certificateDetails) || L(item.certificateLabel);
    const verification = L(item.verificationLabel);
    const deadline = L(item.deadlineLabel);
    const heading = status || deadline || T('راجع التفاصيل الرسمية', 'Review the official details');
    const related = data.filter(other => other.kind === item.kind && other.id !== item.id).slice(0, 2);
    const list = (items, cls) => `<ul class="${cls}">${(Array.isArray(items) ? items : []).map(value => `<li><span class="list-check">${icon('check', 16)}</span><span>${esc(L(value))}</span></li>`).join('')}</ul>`;
    const color = item.kind === 'course' ? 'gold' : 'violet';
    host.innerHTML = `<nav class="breadcrumbs" aria-label="${T('مسار الصفحة', 'Breadcrumb')}"><a href="#explore" data-page="explore">${T('استكشف الفرص', 'Explore opportunities')}</a><span aria-hidden="true">/</span><span>${esc(typeName(item))}</span></nav>
      <div class="detail-heading">
        <div class="provider-lockup"><span class="provider-mark ${color}" aria-hidden="true">${esc(item.mark || 'OG')}</span><span class="provider-name">${esc(L(item.provider))}</span><span class="card-kind ${color}">${esc(typeName(item))}</span>${status ? `<span class="status-label">${esc(status)}</span>` : ''}</div>
        <h1>${esc(L(item.title))}</h1><p class="detail-summary">${esc(L(item.summary))}</p>
        <div class="card-meta"><span class="meta-item">${icon('map-pin', 18)}${esc(L(item.location))}</span><span class="meta-item">${icon('cap', 18)}${esc(L(item.level))}</span>${item.format ? `<span class="meta-item">${icon('book', 18)}${esc(L(item.format))}</span>` : ''}</div>
      </div>
      <div class="detail-layout"><div class="detail-main">
        <section class="detail-section"><span class="section-index" aria-hidden="true">01</span><h2>${T('تعرّف على الفرصة', 'About this opportunity')}</h2><p>${esc(L(item.description) || L(item.summary))}</p>${item.statusScope ? `<p class="detail-context">${esc(L(item.statusScope))}</p>` : ''}${item.contentLanguage ? `<p class="detail-context"><strong>${T('لغة المحتوى: ', 'Content language: ')}</strong>${esc(L(item.contentLanguage))}</p>` : ''}</section>
        <section class="detail-section"><span class="section-index" aria-hidden="true">02</span><h2>${T('قبل أن تبدأ', 'Before you get started')}</h2>${list(item.requirements, 'check-list')}</section>
        <section class="detail-section"><span class="section-index" aria-hidden="true">03</span><h2>${T('ما الذي تقدمه لك؟', 'What you can expect')}</h2>${list(item.benefits, 'benefit-list')}${certificate ? `<div class="certificate-note"><h3>${T('الشهادة', 'Certificate')}</h3><p>${esc(certificate)}</p>${item.certificateUrl && applicationInfo({applicationUrl:item.certificateUrl}).url ? `<a class="detail-link" href="${esc(item.certificateUrl)}" target="_blank" rel="noopener noreferrer">${T('سياسة الشهادة لدى الجهة', 'Provider certificate policy')}${icon('link',15)}</a>` : ''}</div>` : ''}</section>
      </div><aside class="detail-sidebar">
        <section class="apply-panel"><span class="eyebrow">${T('خطوتك التالية', 'YOUR NEXT STEP')}</span><h2>${esc(heading)}</h2>${deadline && deadline !== heading ? `<p class="apply-deadline">${esc(deadline)}</p>` : ''}${item.deadlineNote ? `<p class="deadline-note">${esc(L(item.deadlineNote))}</p>` : ''}<p>${T('اطّلع على التفاصيل والمواعيد وشروط الأهلية مباشرة لدى الجهة.', 'Check the full details, deadlines and eligibility directly with the provider.')}</p>
          ${target.url ? `<a class="btn btn-primary full" href="${esc(target.url)}" target="_blank" rel="noopener noreferrer">${actionLabel}${icon('link', 18)}</a>` : `<p class="source-unavailable">${T('رابط المصدر غير متاح حاليًا.', 'The source link is currently unavailable.')}</p>`}
          ${saveButton(item, true)}${target.host ? `<small class="source-host" dir="ltr">${esc(target.host)}</small>` : ''}
        </section>
        <section class="source-panel"><span class="source-icon">${icon('info', 18)}</span><h3>${T('ارجع دائمًا إلى الجهة', 'Go directly to the provider')}</h3><p>${T('هذه نبذة لمساعدتك على الاستكشاف. التفاصيل الرسمية وشروط التقديم هي المرجع.', 'This overview helps you explore. Official programme details and application terms remain the reference.')}</p>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(L(item.provider))}${icon('link', 15)}</a>` : ''}
          ${item.notes ? `<p class="detail-context">${esc(L(item.notes))}</p>` : ''}${verification ? `<div class="verification-note"><h4>${T('حالة المعلومات', 'Information status')}</h4><p>${esc(verification)}</p></div>` : ''}
        </section>
      </aside></div>
      ${related.length ? `<section class="related-section"><div class="section-heading"><div><span class="eyebrow">${T('واصل الاستكشاف', 'KEEP EXPLORING')}</span><h2>${T('مسارات أخرى قد تهمك', 'More possibilities to explore')}</h2></div><a class="detail-link" href="#explore" data-page="explore">${T('كل الفرص', 'All opportunities')}${icon('arrow', 18)}</a></div><div class="related-grid">${related.map(card).join('')}</div></section>` : ''}`;
  }

  function updateBookmarkButtons(id) {
    const item = byId.get(String(id));
    if (!item) return;
    const saved = state.saved.has(String(id));
    $$('[data-save]').filter(button => button.dataset.save === String(id)).forEach(button => {
      const full = button.dataset.saveFull === 'true';
      const label = (saved ? T('إزالة من المفضلة: ', 'Remove from saved: ') : T('حفظ في المفضلة: ', 'Save opportunity: ')) + L(item.title);
      button.classList.toggle('is-saved', saved);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.innerHTML = icon('bookmark', full ? 19 : 20, saved) + (full ? `<span>${saved ? T('محفوظة في المفضلة', 'Saved to your shortlist') : T('حفظ في المفضلة', 'Save opportunity')}</span>` : '');
    });
  }

  function toggleSaved(id, trigger) {
    id = String(id);
    if (!byId.has(id)) return;
    const adding = !state.saved.has(id);
    adding ? state.saved.add(id) : state.saved.delete(id);
    const persistent = writeStorage(keys.saved, JSON.stringify([...state.saved]));
    let index = -1;
    if (state.page === 'favorites' && trigger) index = $$('[data-save]', $('#favorites-grid') || document).indexOf(trigger);
    updateBookmarkButtons(id);
    renderFavorites();
    if (index >= 0 && !adding) {
      const choices = $$('[data-save]', $('#favorites-grid') || document);
      const next = choices[Math.min(index, choices.length - 1)] || $('#favorites-grid .empty-state a');
      next?.focus({ preventScroll: true });
    }
    announce(adding ? (persistent ? T('أُضيفت الفرصة إلى مفضلتك', 'Opportunity added to your shortlist') : T('حُفظت الفرصة لهذه الجلسة فقط', 'Saved for this session only')) : T('أُزيلت الفرصة من المفضلة', 'Opportunity removed from your shortlist'));
  }

  function closeMenu() {
    state.menuOpen = false;
    const menu = $('#mobile-nav');
    if (menu) { menu.hidden = true; menu.classList.remove('is-open'); }
    const button = $('#menu-button');
    if (button) { button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', T('فتح قائمة التنقل', 'Open navigation menu')); }
  }

  function setTitle() {
    const titles = { explore: T('استكشف الفرص', 'Explore opportunities'), favorites: T('المفضلة', 'Saved opportunities'), about: T('عن البوابة', 'About the gateway'), detail: L(byId.get(state.detailId)?.title) || T('تفاصيل الفرصة', 'Opportunity details') };
    document.title = `${titles[state.page]} | ${T('بوّابة الفرص', 'Opportunity Gateway')}`;
  }

  function staticTranslations() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    $$('[data-ar][data-en]').forEach(element => { element.textContent = element.dataset[state.lang]; });
    $$('[data-placeholder-ar][data-placeholder-en]').forEach(element => { element.setAttribute('placeholder', element.getAttribute('data-placeholder-' + state.lang)); });
    $$('[data-label-ar][data-label-en]').forEach(element => { element.setAttribute('aria-label', element.getAttribute('data-label-' + state.lang)); });
    const button = $('#language-button');
    if (button) {
      button.innerHTML = `${icon('globe', 18)}<span>${state.lang === 'ar' ? 'English' : 'العربية'}</span>`;
      button.setAttribute('aria-label', state.lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
      button.setAttribute('lang', state.lang === 'ar' ? 'en' : 'ar');
    }
    $$('[data-total-count]').forEach(element => { element.textContent = number(data.length); });
    $$('[data-kind-count]').forEach(element => { element.textContent = number(data.filter(item => item.kind === element.dataset.kindCount).length); });
    setTitle();
    updateOffline();
  }

  function applyPage(route, initial = false) {
    if (!initial && currentRoute) scrollPositions.set(currentRoute, window.scrollY);
    const raw = (route || '#explore').replace(/^#\/?/, '');
    let page = raw.split('/')[0];
    if (!['explore', 'detail', 'favorites', 'about'].includes(page)) page = 'explore';
    let id = '';
    if (page === 'detail') {
      try { id = decodeURIComponent(raw.split('/').slice(1).join('/')); } catch (_) { id = ''; }
    }
    state.page = page; state.detailId = id;
    currentRoute = page === 'detail' ? `#detail/${encodeURIComponent(id)}` : `#${page}`;
    ['explore', 'detail', 'favorites', 'about'].forEach(name => {
      const element = $('#page-' + name);
      if (element) { element.classList.toggle('hidden', name !== page); element.hidden = name !== page; }
    });
    $$('[data-page]').forEach(link => {
      const active = link.dataset.page === (page === 'detail' ? 'explore' : page);
      link.classList.toggle('is-active', active);
      if (active && page !== 'detail') link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    closeMenu();
    if (page === 'detail') renderDetail(id);
    if (page === 'favorites') renderFavorites();
    if (page === 'explore') renderResults();
    setTitle();
    if (!initial) {
      const top = page === 'explore' ? scrollPositions.get('#explore') || 0 : 0;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: 'instant' });
        const focusTarget = page === 'detail' ? $('#detail-content h1') : $('#page-' + page + ' h1');
        if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
      });
    }
  }

  function navigate(page) {
    const hash = '#' + page;
    if (location.hash === hash || (!location.hash && page === 'explore')) applyPage(hash);
    else location.hash = hash;
  }

  function resetFilters() {
    clearTimeout(searchTimer);
    Object.assign(state, { query: '', kind: 'all', field: 'all', place: 'all' });
    renderResults();
    announce(T('تم مسح البحث والفلاتر', 'Search and filters cleared'));
  }

  function scrollToResults() {
    const target = $('#results-heading') || $('#opportunities') || $('#results-grid');
    if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function focusSearch() {
    if (state.page !== 'explore') navigate('explore');
    requestAnimationFrame(() => {
      const input = $('#search-input');
      if (input) { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); input.focus({ preventScroll: true }); }
    });
  }

  function updateOffline() {
    const banner = $('#offline-banner');
    if (!banner) return;
    banner.hidden = navigator.onLine;
    banner.classList.toggle('hidden', navigator.onLine);
    if (!navigator.onLine) banner.textContent = T('أنت دون اتصال الآن. ستحتاج إلى الإنترنت لزيارة المصادر الرسمية.', 'You are offline. An internet connection is needed to visit official sources.');
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const skip = target.closest('.skip-link');
    if (skip) {
      event.preventDefault();
      const main = $('#main');
      main?.focus({ preventScroll: true });
      main?.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    const save = target.closest('[data-save]');
    if (save) { event.preventDefault(); toggleSaved(save.dataset.save, save); return; }
    const category = target.closest('[data-kind]');
    if (category) {
      event.preventDefault();
      const kind = category.dataset.kind;
      if (!['all', 'course', 'scholarship'].includes(kind)) return;
      state.kind = kind;
      state.page === 'explore' ? renderResults() : navigate('explore');
      if (category.dataset.scrollResults === 'true' || category.classList.contains('pathway')) scrollToResults();
      return;
    }
    const removeFilter = target.closest('[data-remove-filter]');
    if (removeFilter) {
      const key = removeFilter.dataset.removeFilter;
      if (['query', 'kind', 'field', 'place'].includes(key)) {
        state[key] = key === 'query' ? '' : 'all';
        renderResults();
        ($('#active-filters button') || $('#search-input'))?.focus({ preventScroll: true });
      }
      return;
    }
    const action = target.closest('[data-action]');
    if (action?.dataset.action === 'reset-filters') { event.preventDefault(); resetFilters(); return; }
    if (action?.dataset.action === 'focus-search') { event.preventDefault(); focusSearch(); return; }
    if (action?.dataset.action === 'go-results') { event.preventDefault(); if (state.page !== 'explore') navigate('explore'); requestAnimationFrame(scrollToResults); return; }
    const link = target.closest('[data-page]');
    if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault(); navigate(link.dataset.page); return;
    }
    if (state.menuOpen && !target.closest('#mobile-nav') && !target.closest('#menu-button')) closeMenu();
  });

  $('#search-form')?.addEventListener('submit', event => {
    event.preventDefault(); clearTimeout(searchTimer);
    state.query = ($('#search-input')?.value || '').trim();
    renderResults(); scrollToResults();
  });
  $('#search-input')?.addEventListener('input', event => {
    clearTimeout(searchTimer);
    state.query = event.target.value;
    searchTimer = window.setTimeout(renderResults, 160);
  });
  [['field-filter', 'field'], ['place-filter', 'place'], ['sort-select', 'sort']].forEach(([id, key]) => {
    $('#' + id)?.addEventListener('change', event => { state[key] = event.target.value; renderResults(); });
  });
  $('#clear-filters')?.addEventListener('click', event => { event.preventDefault(); resetFilters(); });
  $('#filter-toggle')?.addEventListener('click', () => {
    state.filtersOpen = !state.filtersOpen;
    $('#filters')?.classList.toggle('is-open', state.filtersOpen);
    $('#filter-toggle')?.setAttribute('aria-expanded', String(state.filtersOpen));
  });
  $('#menu-button')?.addEventListener('click', () => {
    state.menuOpen = !state.menuOpen;
    const menu = $('#mobile-nav');
    if (menu) { menu.hidden = !state.menuOpen; menu.classList.toggle('is-open', state.menuOpen); }
    const button = $('#menu-button');
    button?.setAttribute('aria-expanded', String(state.menuOpen));
    button?.setAttribute('aria-label', state.menuOpen ? T('إغلاق قائمة التنقل', 'Close navigation menu') : T('فتح قائمة التنقل', 'Open navigation menu'));
  });
  $('#language-button')?.addEventListener('click', () => {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    writeStorage(keys.lang, state.lang);
    staticTranslations(); renderResults(); renderFavorites();
    if (state.page === 'detail') renderDetail(state.detailId);
    closeMenu(); setTitle();
  });
  $('#scroll-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.menuOpen) { closeMenu(); $('#menu-button')?.focus(); }
  });
  window.addEventListener('hashchange', () => applyPage(location.hash));
  window.addEventListener('online', updateOffline);
  window.addEventListener('offline', updateOffline);
  window.addEventListener('storage', event => {
    if (event.key === keys.saved) {
      try {
        const value = JSON.parse(event.newValue || '[]');
        if (!Array.isArray(value)) return;
        state.saved = new Set(value.map(String).filter(id => byId.has(id)));
        data.forEach(item => updateBookmarkButtons(item.id)); renderFavorites();
      } catch (_) { /* Keep the working shortlist when another tab writes invalid data. */ }
    }
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  staticTranslations(); renderResults(); renderFavorites(); applyPage(location.hash, true);
})();
