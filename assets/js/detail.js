/**
 * Opportunity Gateway 2 — Detail page logic (Agent B)
 * Safely parses the opportunity ID from URL query parameters,
 * renders all verified details via the DOM API, ensures HTTPS safety,
 * handles missing/corrupt IDs, and displays related canonical opportunities.
 */

import { loadOpportunities, getOpportunityById, getAllOpportunitiesMap } from './data.js';
import {
  getLang, setLang, t, loc, applyStaticTranslations, formatLevels,
  formatDeadlineSummary, getTypeName
} from './i18n.js';
import {
  $, readSavedIds, writeSavedIds, announce, getIcon,
  safeHTTPSUrl, getSafeHostname, buildOpportunityCard,
  syncBookmarkButtons, updateNavBookmarkCount, setupMobileNav, setupOfflineBanner
} from './common.js';

let currentOpp = null;
let savedIds = new Set();
let opportunitiesMap = new Map();
let allOpportunities = [];

function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return '';
  return id.trim();
}

function renderNotFound() {
  const container = $('#detail-content');
  if (!container) return;

  document.title = `${t('الفرصة غير موجودة', 'Opportunity not found')} | ${t('بوّابة الفرص ٢', 'Opportunity Gateway 2')}`;

  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${getIcon('search', 32)}</div>
      <h2>${t('لم نعثر على هذه الفرصة', 'Opportunity could not be found')}</h2>
      <p>${t('قد يكون الرابط غير مكتمل أو أن المعرّف المطلوب غير مسجل في البيانات المعتمدة. يمكنك استكشاف الفرص المتاحة من القائمة الرئيسية.', 'The link may be incomplete or the requested ID is not in the verified dataset. You can explore available opportunities on the home page.')}</p>
      <a class="btn btn-primary" href="index.html">
        <span>${t('العودة إلى استكشاف الفرص', 'Back to explore opportunities')}</span>
        ${getIcon('arrow', 18)}
      </a>
    </div>
  `;
}

function renderDetail(opp) {
  const container = $('#detail-content');
  if (!container) return;

  const lang = getLang();
  document.title = `${loc(opp.title)} | ${t('بوّابة الفرص ٢', 'Opportunity Gateway 2')}`;

  container.innerHTML = '';

  // 1. Breadcrumbs
  const breadcrumbs = document.createElement('nav');
  breadcrumbs.className = 'breadcrumbs';
  breadcrumbs.setAttribute('aria-label', t('مسار التصفح', 'Breadcrumbs'));

  const homeLink = document.createElement('a');
  homeLink.href = 'index.html';
  homeLink.textContent = t('استكشف الفرص', 'Explore opportunities');

  const sep1 = document.createElement('span');
  sep1.setAttribute('aria-hidden', 'true');
  sep1.textContent = '/';

  const kindLink = document.createElement('a');
  kindLink.href = `index.html`;
  kindLink.textContent = getTypeName(opp.type, lang);

  const sep2 = document.createElement('span');
  sep2.setAttribute('aria-hidden', 'true');
  sep2.textContent = '/';

  const currentSpan = document.createElement('span');
  currentSpan.textContent = loc(opp.title);

  breadcrumbs.appendChild(homeLink);
  breadcrumbs.appendChild(sep1);
  breadcrumbs.appendChild(kindLink);
  breadcrumbs.appendChild(sep2);
  breadcrumbs.appendChild(currentSpan);
  container.appendChild(breadcrumbs);

  // 2. Heading Lockup
  const colorClass = opp.display?.color === 'gold' ? 'gold' : 'violet';
  const headingBox = document.createElement('div');
  headingBox.className = 'detail-heading';

  const topRow = document.createElement('div');
  topRow.className = 'provider-lockup';

  const markSpan = document.createElement('span');
  markSpan.className = `provider-mark ${colorClass}`;
  markSpan.setAttribute('aria-hidden', 'true');
  markSpan.textContent = opp.display?.mark || (opp.type === 'course' ? 'COURSE' : 'SCHOLAR');

  const provName = document.createElement('span');
  provName.className = 'provider-name';
  provName.textContent = loc(opp.provider);

  const kindBadge = document.createElement('span');
  kindBadge.className = `card-kind ${colorClass}`;
  kindBadge.textContent = getTypeName(opp.type, lang);

  topRow.appendChild(markSpan);
  topRow.appendChild(provName);
  topRow.appendChild(kindBadge);

  if (opp.type === 'course') {
    const freeStudy = document.createElement('span');
    freeStudy.className = 'status-label';
    freeStudy.textContent = t('دراسة مجانية', 'Free learning');
    topRow.appendChild(freeStudy);
  } else if (opp.status === 'open') {
    const openBadge = document.createElement('span');
    openBadge.className = 'status-label';
    openBadge.textContent = opp.id === 'opp-018'
      ? t('برامج مفتوحة عند الفحص', 'Open programmes at check date')
      : t('مفتوحة عند الفحص', 'Open at check date');
    topRow.appendChild(openBadge);
  }
  headingBox.appendChild(topRow);

  const h1 = document.createElement('h1');
  h1.textContent = loc(opp.title);
  headingBox.appendChild(h1);

  const summaryP = document.createElement('p');
  summaryP.className = 'detail-summary';
  summaryP.textContent = loc(opp.summary) || loc(opp.description);
  headingBox.appendChild(summaryP);

  const metaRow = document.createElement('div');
  metaRow.className = 'card-meta';

  const locMeta = document.createElement('span');
  locMeta.className = 'meta-item';
  locMeta.innerHTML = getIcon(opp.type === 'course' ? 'globe' : 'map-pin', 18);
  const locTxt = document.createElement('span');
  locTxt.textContent = loc(opp.country);
  locMeta.appendChild(locTxt);
  metaRow.appendChild(locMeta);

  const lvlMeta = document.createElement('span');
  lvlMeta.className = 'meta-item';
  lvlMeta.innerHTML = getIcon('cap', 18);
  const lvlTxt = document.createElement('span');
  lvlTxt.textContent = formatLevels(opp.levels, lang);
  lvlMeta.appendChild(lvlTxt);
  metaRow.appendChild(lvlMeta);

  if (opp.type === 'course' && opp.course?.duration?.label) {
    const durMeta = document.createElement('span');
    durMeta.className = 'meta-item';
    durMeta.innerHTML = getIcon('book', 18);
    const durTxt = document.createElement('span');
    durTxt.textContent = loc(opp.course.duration.label);
    durMeta.appendChild(durTxt);
    metaRow.appendChild(durMeta);
  }

  headingBox.appendChild(metaRow);
  container.appendChild(headingBox);

  // 3. Detail Layout: Main Column + Sidebar Column
  const layout = document.createElement('div');
  layout.className = 'detail-layout';

  // MAIN COLUMN
  const mainCol = document.createElement('div');
  mainCol.className = 'detail-main';

  // Section 01: About opportunity
  const sec1 = document.createElement('section');
  sec1.className = 'detail-section';
  sec1.innerHTML = `
    <span class="section-index" aria-hidden="true">01</span>
    <h2>${t('تعرّف على الفرصة', 'About this opportunity')}</h2>
  `;
  const descParagraph = document.createElement('p');
  descParagraph.textContent = loc(opp.description) || loc(opp.summary);
  sec1.appendChild(descParagraph);

  if (opp.status_scope) {
    const scopeP = document.createElement('p');
    scopeP.className = 'detail-context';
    scopeP.innerHTML = `<strong>${t('نطاق البرنامج: ', 'Programme scope: ')}</strong>`;
    const scopeTxt = document.createTextNode(loc(opp.status_scope));
    scopeP.appendChild(scopeTxt);
    sec1.appendChild(scopeP);
  }

  if (opp.type === 'course' && opp.course?.content_languages) {
    const langP = document.createElement('p');
    langP.className = 'detail-context';
    const hasAr = opp.course.content_languages.includes('ar');
    langP.innerHTML = `<strong>${t('لغات المحتوى: ', 'Content language: ')}</strong>`;
    const langTxt = document.createTextNode(hasAr
      ? t('العربية والإنجليزية متاحتان ضمن اللغات', 'Arabic and English available among languages')
      : t('الإنجليزية متحققة في المصدر؛ راجع لغات المنصة', 'English verified; check platform for other languages')
    );
    langP.appendChild(langTxt);
    sec1.appendChild(langP);
  }
  mainCol.appendChild(sec1);

  // Section 02: Requirements
  const sec2 = document.createElement('section');
  sec2.className = 'detail-section';
  sec2.innerHTML = `
    <span class="section-index" aria-hidden="true">02</span>
    <h2>${t('شروط ومتطلبات البدء', 'Requirements and Eligibility')}</h2>
  `;
  if (opp.eligibility) {
    const eligP = document.createElement('p');
    eligP.innerHTML = `<strong>${t('الأهلية العامة: ', 'General eligibility: ')}</strong>`;
    eligP.appendChild(document.createTextNode(loc(opp.eligibility)));
    sec2.appendChild(eligP);
  }

  const reqList = document.createElement('ul');
  reqList.className = 'check-list';
  const reqItems = opp.requirements?.[lang] || opp.requirements?.ar || opp.requirements?.en || [];
  reqItems.forEach(req => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="list-check">${getIcon('check', 16)}</span>`;
    const span = document.createElement('span');
    span.textContent = req;
    li.appendChild(span);
    reqList.appendChild(li);
  });
  sec2.appendChild(reqList);
  mainCol.appendChild(sec2);

  // Section 03: Benefits & Certificate
  const sec3 = document.createElement('section');
  sec3.className = 'detail-section';
  sec3.innerHTML = `
    <span class="section-index" aria-hidden="true">03</span>
    <h2>${t('ما الذي تقدمه لك؟', 'Benefits and Coverage')}</h2>
  `;
  const benList = document.createElement('ul');
  benList.className = 'benefit-list';
  if (opp.funding) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="list-check">${getIcon('check', 16)}</span>`;
    const span = document.createElement('span');
    span.textContent = loc(opp.funding);
    li.appendChild(span);
    benList.appendChild(li);
  }
  sec3.appendChild(benList);

  if (opp.type === 'course' && opp.course?.certificate) {
    const certDiv = document.createElement('div');
    certDiv.className = 'certificate-note';
    const certH3 = document.createElement('h3');
    certH3.textContent = t('تفاصيل الشهادة', 'Certificate details');
    certDiv.appendChild(certH3);

    const certP = document.createElement('p');
    certP.textContent = loc(opp.course.certificate.details) || loc(opp.course.certificate.label);
    certDiv.appendChild(certP);

    const certSafeUrl = safeHTTPSUrl(opp.course.certificate.source_url);
    if (certSafeUrl) {
      const certA = document.createElement('a');
      certA.className = 'detail-link';
      certA.href = certSafeUrl;
      certA.target = '_blank';
      certA.rel = 'noopener noreferrer';
      certA.innerHTML = `<span>${t('سياسة الشهادة لدى الجهة الرسمية', 'Provider certificate policy')}</span>${getIcon('link', 15)}`;
      certDiv.appendChild(certA);
    }
    sec3.appendChild(certDiv);
  }
  mainCol.appendChild(sec3);

  layout.appendChild(mainCol);

  // SIDEBAR COLUMN
  const sidebar = document.createElement('aside');
  sidebar.className = 'detail-sidebar';

  // Apply Panel
  const applyPanel = document.createElement('section');
  applyPanel.className = 'apply-panel';
  applyPanel.innerHTML = `<span class="eyebrow">${t('خطوتك التالية', 'YOUR NEXT STEP')}</span>`;

  const deadlineInfo = formatDeadlineSummary(opp.deadline, lang);
  const panelH2 = document.createElement('h2');
  panelH2.textContent = deadlineInfo.text || t('راجع التفاصيل الرسمية', 'Review official details');
  applyPanel.appendChild(panelH2);

  if (opp.deadline?.note) {
    const deadNoteP = document.createElement('p');
    deadNoteP.className = 'deadline-note';
    deadNoteP.textContent = loc(opp.deadline.note);
    applyPanel.appendChild(deadNoteP);
  }

  const applyExplain = document.createElement('p');
  applyExplain.textContent = t(
    'اطّلع على التفاصيل الكاملة والمواعيد المحدثة لدى الجهة قبل التقديم.',
    'Check current requirements, dates, and official guidelines directly with the provider.'
  );
  applyPanel.appendChild(applyExplain);

  // Safe CTA Action Link
  const targetUrl = safeHTTPSUrl(opp.application_url) || safeHTTPSUrl(opp.source_url);
  if (targetUrl) {
    const ctaA = document.createElement('a');
    ctaA.className = 'btn btn-primary full';
    ctaA.href = targetUrl;
    ctaA.target = '_blank';
    ctaA.rel = 'noopener noreferrer';
    const ctaLabel = opp.application_url
      ? (opp.type === 'course' ? t('ابدأ التعلم لدى الجهة', 'Start learning with provider') : t('خطوات التقديم لدى الجهة', 'Application steps with provider'))
      : t('زيارة المصدر الرسمي', 'Visit official source');
    ctaA.innerHTML = `<span>${ctaLabel}</span>${getIcon('link', 18)}`;
    applyPanel.appendChild(ctaA);

    const hostSpan = document.createElement('small');
    hostSpan.className = 'source-host';
    hostSpan.dir = 'ltr';
    hostSpan.textContent = getSafeHostname(targetUrl);
    applyPanel.appendChild(hostSpan);
  }

  // Full-width Bookmark Button
  const isSaved = savedIds.has(opp.id);
  const fullSaveBtn = document.createElement('button');
  fullSaveBtn.type = 'button';
  fullSaveBtn.className = `btn btn-secondary full${isSaved ? ' is-saved' : ''}`;
  fullSaveBtn.dataset.save = opp.id;
  fullSaveBtn.dataset.saveFull = 'true';
  fullSaveBtn.setAttribute('aria-pressed', String(isSaved));
  const saveBtnLabel = (isSaved ? t('إزالة من المفضلة: ', 'Remove from saved: ') : t('حفظ في المفضلة: ', 'Save opportunity: ')) + loc(opp.title);
  fullSaveBtn.setAttribute('aria-label', saveBtnLabel);
  fullSaveBtn.innerHTML = `${getIcon('bookmark', 19, isSaved)}<span>${isSaved ? t('محفوظة في المفضلة', 'Saved to shortlist') : t('حفظ في المفضلة', 'Save opportunity')}</span>`;

  fullSaveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSave(opp);
  });
  applyPanel.appendChild(fullSaveBtn);

  sidebar.appendChild(applyPanel);

  // Source Panel
  const sourcePanel = document.createElement('section');
  sourcePanel.className = 'source-panel';
  sourcePanel.innerHTML = `
    <h3>${getIcon('info', 18)}<span>${t('ارجع دائمًا إلى الجهة', 'Go directly to the source')}</span></h3>
    <p>${t('هذه نبذة استكشافية لمساعدتك. الشروط والمواعيد الرسمية المعتمدة لدى الجهة هي المرجع الحاسم.', 'This is an exploratory overview. The provider’s official terms remain the definitive reference.')}</p>
  `;

  const safeSource = safeHTTPSUrl(opp.source_url);
  if (safeSource) {
    const srcA = document.createElement('a');
    srcA.href = safeSource;
    srcA.target = '_blank';
    srcA.rel = 'noopener noreferrer';

    const pSpan = document.createElement('span');
    pSpan.textContent = loc(opp.provider);
    srcA.appendChild(pSpan);

    const iconSpan = document.createElement('span');
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.innerHTML = getIcon('link', 15);
    srcA.appendChild(iconSpan);

    sourcePanel.appendChild(srcA);
  }

  if (opp.notes) {
    const notesP = document.createElement('p');
    notesP.className = 'detail-context';
    notesP.textContent = loc(opp.notes);
    sourcePanel.appendChild(notesP);
  }

  // Verification status note
  const verifDiv = document.createElement('div');
  verifDiv.className = 'verification-note';
  verifDiv.innerHTML = `<h4>${t('حالة تدقيق المعلومات', 'Information verification status')}</h4>`;
  const verifP = document.createElement('p');

  if (opp.human_review?.status === 'complete' && opp.human_review?.reviewed_at && opp.human_review?.reviewer) {
    verifP.textContent = t(
      `تمت مراجعة بشرية بتاريخ ${opp.human_review.reviewed_at} بواسطة ${opp.human_review.reviewer}.`,
      `Human review completed on ${opp.human_review.reviewed_at} by ${opp.human_review.reviewer}.`
    );
  } else {
    verifP.textContent = t(
      `فحص آلي للمصدر الرسمي بتاريخ: ${opp.verified_at}. المراجعة البشرية معلّقة.`,
      `Automated official source check as of ${opp.verified_at}. Human review is pending.`
    );
  }
  verifDiv.appendChild(verifP);
  sourcePanel.appendChild(verifDiv);

  sidebar.appendChild(sourcePanel);
  layout.appendChild(sidebar);

  container.appendChild(layout);

  // 4. Related Opportunities Section
  const related = allOpportunities.filter(o => o.type === opp.type && o.id !== opp.id).slice(0, 2);
  if (related.length > 0) {
    const relSec = document.createElement('section');
    relSec.className = 'related-section';
    relSec.innerHTML = `
      <div class="section-heading">
        <div>
          <span class="eyebrow">${t('واصل الاستكشاف', 'KEEP EXPLORING')}</span>
          <h2>${opp.type === 'course' ? t('دورات تقنية أخرى قد تهمك', 'More tech courses you might like') : t('منح دراسية أخرى قد تهمك', 'More scholarships to explore')}</h2>
        </div>
        <a class="detail-link" href="index.html">
          <span>${t('كل الفرص', 'All opportunities')}</span>
          ${getIcon('arrow', 18)}
        </a>
      </div>
    `;
    const relGrid = document.createElement('div');
    relGrid.className = 'related-grid';
    related.forEach(other => {
      const otherSaved = savedIds.has(other.id);
      relGrid.appendChild(buildOpportunityCard(other, otherSaved, toggleSave));
    });
    relSec.appendChild(relGrid);
    container.appendChild(relSec);
  }
}

function toggleSave(opp) {
  const id = opp.id;
  const isAdding = !savedIds.has(id);

  if (isAdding) {
    savedIds.add(id);
  } else {
    savedIds.delete(id);
  }

  const persisted = writeSavedIds(savedIds);
  syncBookmarkButtons(id, isAdding, loc(opp.title));
  updateNavBookmarkCount(savedIds.size);

  if (isAdding) {
    announce(persisted
      ? t('أُضيفت الفرصة إلى مفضلتك', 'Opportunity added to your shortlist')
      : t('حُفظت الفرصة مؤقتًا لهذه الجلسة', 'Saved for this session only')
    );
  } else {
    announce(t('أُزيلت الفرصة من مفضلتك', 'Opportunity removed from your shortlist'));
  }
}

async function init() {
  setupMobileNav();
  setupOfflineBanner();
  applyStaticTranslations();

  try {
    allOpportunities = await loadOpportunities();
    opportunitiesMap = await getAllOpportunitiesMap();
    savedIds = readSavedIds(opportunitiesMap);
    updateNavBookmarkCount(savedIds.size);

    const id = getIdFromUrl();
    if (!id || !opportunitiesMap.has(id)) {
      renderNotFound();
      return;
    }

    currentOpp = opportunitiesMap.get(id);
    renderDetail(currentOpp);

    // Language switcher
    $('#language-button')?.addEventListener('click', () => {
      const nextLang = (getLang() === 'ar') ? 'en' : 'ar';
      setLang(nextLang);
      applyStaticTranslations();
      if (currentOpp) renderDetail(currentOpp);
      announce(nextLang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
    });

    // Cross-tab storage updates
    window.addEventListener('storage', (e) => {
      if (e.key === 'opportunity-gateway2:saved:v1') {
        savedIds = readSavedIds(opportunitiesMap);
        updateNavBookmarkCount(savedIds.size);
        if (currentOpp) {
          syncBookmarkButtons(currentOpp.id, savedIds.has(currentOpp.id), loc(currentOpp.title));
        }
      }
    });
  } catch (err) {
    console.error('Detail page error:', err);
    renderNotFound();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
