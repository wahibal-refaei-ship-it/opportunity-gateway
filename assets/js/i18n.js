/**
 * Internationalization (i18n) and localization module
 * Handles Arabic (ar) / English (en) dictionaries, RTL/LTR switching,
 * date/number formatting, and Arabic text normalization.
 */

const STORAGE_KEY_LANG = 'opportunity-gateway2:language';

let currentLang = 'ar';
try {
  const stored = localStorage.getItem(STORAGE_KEY_LANG);
  if (stored === 'en' || stored === 'ar') currentLang = stored;
} catch (_) {
  currentLang = 'ar';
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = (lang === 'en') ? 'en' : 'ar';
  try {
    localStorage.setItem(STORAGE_KEY_LANG, currentLang);
  } catch (_) {
    // Graceful degradation when storage is unavailable
  }
}

/**
 * Helper to pick localized value from an object or fallback.
 */
export function t(ar, en) {
  return currentLang === 'ar' ? ar : en;
}

export function loc(bilingualObj) {
  if (!bilingualObj) return '';
  if (typeof bilingualObj === 'string') return bilingualObj;
  return bilingualObj[currentLang] || bilingualObj.ar || bilingualObj.en || '';
}

/**
 * Normalizes Arabic and English text for resilient searching.
 * Strips Arabic diacritics (tashkeel), tatweel (kashida),
 * unifies various forms of alef (أ, إ, آ, ٱ -> ا), and normalizes 'ى' -> 'ي'.
 * Does not alter the original text displayed to the user.
 */
export function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Tashkeel and tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a calendar date (YYYY-MM-DD) nicely for the active language.
 */
export function formatCalendarDate(isoDate, lang = currentLang) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

/**
 * Formats numbers into localized Arabic or English digits.
 */
export function formatNumber(num, lang = currentLang) {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar' : 'en').format(num);
}

/**
 * Returns human-readable label for opportunity types.
 */
export function getTypeName(type, lang = currentLang) {
  if (type === 'scholarship') return lang === 'ar' ? 'منحة دراسية' : 'Scholarship';
  if (type === 'course') return lang === 'ar' ? 'دورة مجانية' : 'Free course';
  return lang === 'ar' ? 'فرصة' : 'Opportunity';
}

/**
 * Dictionary for levels.
 */
export const LEVEL_LABELS = {
  bachelor: { ar: 'بكالوريوس', en: "Bachelor’s" },
  master: { ar: 'ماجستير', en: "Master’s" },
  masters: { ar: 'ماجستير', en: "Master’s" },
  phd: { ar: 'دكتوراه', en: 'PhD' },
  beginner: { ar: 'مبتدئ', en: 'Beginner' },
  ms_phd: { ar: 'ماجستير/دكتوراه', en: 'MS/PhD' }
};

export function formatLevels(levels, lang = currentLang) {
  if (!Array.isArray(levels)) return '';
  return levels.map(lvl => LEVEL_LABELS[lvl] ? LEVEL_LABELS[lvl][lang] : lvl).join(' / ');
}

/**
 * Dictionary for fields.
 */
export const FIELD_LABELS = {
  technology: { ar: 'التقنية والحاسوب', en: 'Technology & computing' },
  business: { ar: 'الأعمال والإدارة', en: 'Business & management' },
  general: { ar: 'تخصصات متعددة', en: 'Multiple fields' },
  multiple: { ar: 'تخصصات متعددة', en: 'Multiple fields' }
};

export function formatField(field, lang = currentLang) {
  return FIELD_LABELS[field] ? FIELD_LABELS[field][lang] : field;
}

/**
 * Dictionary for locations.
 */
export const LOCATION_LABELS = {
  online: { ar: 'عبر الإنترنت', en: 'Online' },
  abroad: { ar: 'دراسة خارجية', en: 'Study abroad' },
  mixed: { ar: 'بحسب البرنامج', en: 'Varies by programme' }
};

/**
 * Dictionary for status.
 */
export const STATUS_LABELS = {
  open: { ar: 'مفتوحة عند الفحص', en: 'Open at check date' },
  closed: { ar: 'مغلقة وفق السجل', en: 'Closed as recorded' },
  upcoming: { ar: 'قادمة', en: 'Upcoming' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review' },
  self_paced: { ar: 'دراسة مجانية مستمرة', en: 'Self-paced free learning' }
};

/**
 * Dictionary for certificate status.
 */
export const CERTIFICATE_STATUS_LABELS = {
  free: { ar: 'شهادة مجانية مثبتة', en: 'Verified free certificate' },
  paid: { ar: 'شهادة مدفوعة (الدراسة مجانية)', en: 'Paid certificate (learning is free)' },
  not_stated: { ar: 'حالة الشهادة غير معلنة في المصدر', en: 'Certificate status not stated in source' },
  none: { ar: 'بدون شهادة', en: 'No certificate' }
};

/**
 * Formats deadline note and status for display on cards.
 */
export function formatDeadlineSummary(deadline, lang = currentLang, asOf = '2026-10-21') {
  if (!deadline) return { text: '', isUrgent: false, isExpired: false };
  if (deadline.type === 'none') {
    return {
      text: lang === 'ar' ? 'تعلّم ذاتي مستمر' : 'Self-paced learning',
      isUrgent: false,
      isExpired: false
    };
  }
  if (deadline.type !== 'fixed') {
    return {
      text: lang === 'ar' ? 'الموعد حسب البرنامج' : 'Programme-specific deadline',
      isUrgent: false,
      isExpired: false
    };
  }
  if (!deadline.closes_at) {
    return {
      text: lang === 'ar' ? 'راجع المصدر' : 'Check source',
      isUrgent: false,
      isExpired: false
    };
  }

  // Calculate calendar days difference
  const asOfDate = new Date(asOf + 'T00:00:00Z');
  const closeDate = new Date(deadline.closes_at + 'T00:00:00Z');
  const diffDays = Math.round((closeDate.getTime() - asOfDate.getTime()) / 86400000);
  const formattedDate = formatCalendarDate(deadline.closes_at, lang);

  if (diffDays < 0) {
    return {
      text: lang === 'ar'
        ? `انتهى الموعد المسجل (${formattedDate}) — راجع المصدر`
        : `Recorded deadline passed (${formattedDate}) — check source`,
      isUrgent: false,
      isExpired: true
    };
  }
  if (diffDays <= 14) {
    return {
      text: lang === 'ar'
        ? `الموعد: ${formattedDate} (متبقٍ ${formatNumber(diffDays, lang)} يوم)`
        : `Closes: ${formattedDate} (${formatNumber(diffDays, lang)} days left)`,
      isUrgent: true,
      isExpired: false
    };
  }
  return {
    text: lang === 'ar' ? `الموعد: ${formattedDate}` : `Closes: ${formattedDate}`,
    isUrgent: false,
    isExpired: false
  };
}

/**
 * Static DOM translation synchronizer.
 * Scans all elements with data-ar and data-en attributes.
 */
export function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-ar][data-en]').forEach(el => {
    el.textContent = (currentLang === 'ar') ? el.getAttribute('data-ar') : el.getAttribute('data-en');
  });

  document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach(el => {
    el.setAttribute('placeholder', (currentLang === 'ar') ? el.getAttribute('data-placeholder-ar') : el.getAttribute('data-placeholder-en'));
  });

  document.querySelectorAll('[data-label-ar][data-label-en]').forEach(el => {
    el.setAttribute('aria-label', (currentLang === 'ar') ? el.getAttribute('data-label-ar') : el.getAttribute('data-label-en'));
  });

  const langBtn = document.getElementById('language-button');
  if (langBtn) {
    const textSpan = langBtn.querySelector('span');
    if (textSpan) textSpan.textContent = (currentLang === 'ar') ? 'English' : 'العربية';
    langBtn.setAttribute('aria-label', (currentLang === 'ar') ? 'Switch to English' : 'التبديل إلى العربية');
    langBtn.setAttribute('lang', (currentLang === 'ar') ? 'en' : 'ar');
  }
}
