# بوابة الفرص ٢ — Opportunity Gateway 2

[English version below](#opportunity-gateway-2--english-documentation)

**بوابة الفرص ٢** هي تطبيق ويب تفاعلي مستقل وثنائي اللغة (العربية والإنجليزية)، مصمم لتمكين الطلبة والخريجين من استكشاف مسارات تعليمية وأكاديمية جادة. يتضمن التطبيق **20 سجلًا معتمدًا**: **10 منح دراسية دولية مختارة** و**10 دورات تقنية مجانية**، مع استبعاد تام لتصنيف التجارب المهنية.

---

## المستودع وحالة النقل — 22 أكتوبر 2026

- **الوجهة الجديدة:** [wahibal-refaei-ship-it/opportunity-gateway](https://github.com/wahibal-refaei-ship-it/opportunity-gateway).
- **حالة النقل:** رُفعت ملفات المشروع الـ95 بنجاح، وتحقق تطابق بصمات جميع الملفات مع النسخة المحفوظة.
- **حالة GitHub Pages:** **غير مفعّل بعد**.
- **الفرع:** `main`.
- **مصدر النسخة المهيأة:** لقطة المصدر عند commit `45c6f05efff1599892306e5ec3cd3e15903fc20e`، مع تحديث ملفَي توثيق الوجهة والحالة فقط.
- **جاهزية النشر:** التطبيق ثابت وجاهز للنشر من `main` والمجلد `/ (root)`؛ يحتوي الجذر على `index.html` و`.nojekyll`.
- **الخطوة المتبقية للنشر:** من `Settings → Pages` اختر `Deploy from a branch` ثم `main` و`/ (root)` واضغط `Save`.
- لا يوجد رابط استضافة منشور للوجهة الجديدة بعد. تفاصيل الحالة والخطوات المتبقية في `DEPLOYMENT-RECORD.md`.

### تاريخ الفحوص السابقة

فحوص الرفع والنشر والمتصفح المسجلة في 21 أكتوبر 2026 تخص النسخة السابقة التي نُشرت في `assemalqudami-maker/opportunity-gateway`. حُذف ذلك المستودع لاحقًا بعد تأكيد المستخدم. نتائج تلك الفحوص محفوظة في `DEPLOYMENT-RECORD.md` كسجل تاريخي، ولا تمثل رفعًا أو اختبار نشر للوجهة الجديدة.

## الميزات والقرارات المعتمدة

1. **الهوية والتصميم**:
   - ألوان الهوية: خلفية بيضاء دافئة (`#FAF9F6`)، بنفسجي عميق (`#55318A`)، بنفسجي داكن (`#392356`)، لمسات ذهبية أنيقة (`#D6AE6A`)، وبطاقات ناصعة (`#FFFFFF`).
   - خط **Cairo** المحلي محمل بالكامل دون أي اتصال بالإنترنت بأوزان متعددة مع رخصة OFL.
   - تصميم متجاوب فائق الجودة يبدأ من شاشات الهواتف الصغيرة (360px) وحتى الشاشات الكبيرة (1440px).
2. **الصفحات الأربع الفعلية**:
   - `index.html`: الاستكشاف، البحث ثنائي اللغة بتطبيع الحروف العربية، والفلاتر المتراكبة (AND).
   - `detail.html`: التفاصيل الكاملة بالمعرف `detail.html?id=...`، ومسار التصفح، وروابط التقديم والمصادر الرسمية الآمنة.
   - `favorites.html`: قائمة المفضلة المحفوظة محليًا في المتصفح مع معالجة البيانات التالفة.
   - `about.html`: رؤية البوابة، المبادئ، سياسة الخصوصية، وحدود العمل دون اتصال.
3. **الدقة والمصداقية**:
   - `data/opportunities.json` هو المصدر الوحيد لعقد البيانات.
   - التمييز الصارم بين **فحص المصادر الآلي** (المؤرخ في 21 أكتوبر 2026) وبين **المراجعة البشرية** (المعلّقة pending).
   - فصل مجانية الدراسة عن حالة وتكلفة الشهادة للدورات التقنية.
4. **الأمان والأداء**:
   - استخدام DOM الآمن و`textContent` لمنع ثغرات XSS.
   - التحقق الصارم من روابط HTTPS ورفض بيانات الاعتماد في الروابط.
   - سياسة أمان المحتوى (CSP) صارمة محلية، دون أي اعتماد على CDNs أو خطوط خارجية أو ملفات تتبع.
   - دعم كامل لتطبيق الويب التقدمي (PWA) والعمل دون اتصال (Offline) عبر Service Worker.

---

## التشغيل المحلي

لتشغيل التطبيق محليًا من جذر المشروع:

```bash
# باستخدام بايثون
python -m http.server 8000

# ثم افتح في المتصفح:
# http://localhost:8000/index.html
```

أو فحص بيانات المشروع والتقرير الأسبوعي:

```bash
# فحص عقد البيانات
node scripts/validate-opportunities.mjs

# تشغيل تقرير المراجعة الأسبوعية
node scripts/weekly-report.mjs
```

---

## هيكل المجلدات

```text
├── index.html                   # صفحة الاستكشاف والبحث
├── detail.html                  # صفحة تفاصيل الفرصة
├── favorites.html               # صفحة المفضلة
├── about.html                   # صفحة عن البوابة
├── manifest.webmanifest         # ملف تكوين PWA
├── service-worker.js            # عامل الخدمة للعمل دون اتصال
├── .nojekyll                    # لتعطيل معالجة Jekyll على GitHub Pages
├── assets/
│   ├── css/styles.css           # أنماط التصميم ونظام المتغيرات
│   ├── fonts/                   # خطوط Cairo المحلية ورخصتها
│   ├── icons/                   # أيقونات SVG ورسوم PWA المحلية
│   └── js/
│       ├── common.js            # دوال DOM والتخزين والروابط الآمنة
│       ├── data.js              # محمل البيانات وفهرسة البحث
│       ├── i18n.js              # قواميس اللغات والتطبيع والتنسيق
│       ├── list.js              # منطق صفحة الاستكشاف
│       ├── detail.js            # منطق صفحة التفاصيل
│       └── favorites.js         # منطق صفحة المفضلة
├── data/
│   ├── opportunities.json       # المصدر المعتمد الوحيد للبيانات (20 سجلًا)
│   └── opportunities.schema.json# عقد المخطط الصارم
├── scripts/
│   ├── validate-opportunities.mjs # فاحص عقد البيانات
│   ├── weekly-report.mjs        # مولد التقرير الأسبوعي للقراءة فقط
│   └── check-links.mjs          # فاحص الروابط المساعد
├── plans/                       # خطط الوكلاء التفصيلية
├── evidence/                    # أدلة اختبارات القبول
├── SETUP-RECORD.md              # سجل إعداد البيئة
├── SCHEDULE-RECORD.md           # سجل الجدولة الأسبوعية
├── DEPLOYMENT-RECORD.md         # سجل النشر
├── TEST-REPORT.md               # تقرير اختبارات القبول الشامل
├── SECURITY-REVIEW.md           # تقرير وإصلاحات الأمان
└── SUBMISSION-CHECKLIST.md      # قائمة التسليم الصادقة
```

---

# Opportunity Gateway 2 — English Documentation

**Opportunity Gateway 2** is a standalone, bilingual (Arabic & English) web application built to help students and graduates explore high-quality educational and scholarship pathways. It features exactly **20 canonical records**: **10 selected international scholarships** and **10 free technology courses**, with the professional internships track completely removed.

## Repository and Transfer Status — 22 October 2026

- **New destination:** [wahibal-refaei-ship-it/opportunity-gateway](https://github.com/wahibal-refaei-ship-it/opportunity-gateway).
- **Transfer status:** All 95 project files were uploaded successfully; every uploaded Git blob matched the prepared local snapshot.
- **GitHub Pages:** Not enabled yet. No published site URL is available for the new destination.
- **Branch:** `main`.
- **Deployment readiness:** The static application is ready for GitHub Pages from `main` and `/ (root)`, with `index.html`, `.nojekyll`, and all required local assets present.
- **Remaining publishing step:** In `Settings → Pages`, choose `Deploy from a branch`, select `main` and `/ (root)`, then select `Save` and verify deployment.
- **Prepared source:** Commit `45c6f05efff1599892306e5ec3cd3e15903fc20e`, with only the two destination/status documentation files updated locally.

The upload, deployment, and browser checks recorded on 21 October 2026 apply to the previous version in `assemalqudami-maker/opportunity-gateway`. That repository was subsequently deleted with the user's confirmation. Those results remain historical evidence in `DEPLOYMENT-RECORD.md`; they do not establish deployment or testing at the new destination.

## Core Features & Decisions

- **Aesthetics & Identity**: Warm paper white (`#FAF9F6`), deep royal purple (`#55318A`), dark plum (`#392356`), and warm gold accents (`#D6AE6A`). Styled using local Cairo fonts with zero runtime external font dependencies.
- **Four Production Pages**: `index.html` (Exploration & multi-layered AND filtering), `detail.html` (Deep linkable details with `?id=...`), `favorites.html` (Resilient LocalStorage shortlist), and `about.html` (Transparency, privacy, and offline documentation).
- **Data Integrity**: Single source of truth in `data/opportunities.json`. Automated official source check dates (2026-10-21) are strictly demarcated from pending human reviews.
- **Offline & PWA Ready**: Scoped `service-worker.js` caching local assets and data for offline reliability after first visit. Zero tracking, zero analytics, zero external CDNs.
