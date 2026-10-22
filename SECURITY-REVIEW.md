# تقرير مراجعة الأمان المستقلة — بوابة الفرص ٢

**دور المراجع:** مراجع أمان مستقل (قراءة فقط)  
**تاريخ المراجعة:** 21 أكتوبر 2026  
**نطاق القراءة المصرح به:**  
- صفحات الإنتاج الأربع: `index.html`, `detail.html`, `favorites.html`, `about.html`  
- أصول PWA والتكوين: `manifest.webmanifest`, `service-worker.js`  
- تنسيقات الأنماط: `assets/css/styles.css`  
- وحدات الجافاسكربت: `assets/js/common.js`, `assets/js/data.js`, `assets/js/i18n.js`, `assets/js/list.js`, `assets/js/detail.js`, `assets/js/favorites.js`  
- مصدر البيانات المعتمد: `data/opportunities.json`  
- أدلة وتقارير الاختبارات: `evidence/agent-a/`, `evidence/agent-b/`, `evidence/agent-c/`  
**commit نقطة البداية للمراجعة:** `af01c4f`  
**حدود التحقق:** فحص ساكِن واختبارات معزولة لمصادر الكود المعدة للنشر؛ لا يتضمن فحص خوادم خارجية أو شبكات مزودي المنح.

---

## 1. جدول الملاحظات والنتائج (Findings)

| المعرّف | مستوى الخطورة | حالة الإثبات | الملف / الموضع | مصدر البيانات ومسار الخطر | الأثر المحتمل | الدليل المقتضب | الإصلاح المقترح | اختبار التحقق المطلوب |
|---|---|---|---|---|---|---|---|---|
| **SEC-FIND-01** | متوسطة (Medium) | مثبتة (Proven) | `assets/js/list.js:290` | مدخل البحث `state.query` من المستخدم يتم تجميعه في شارة الفلتر `chip.label` ثم إدراجه عبر `btn.innerHTML = \`<span>${chip.label}</span>...\`` | في حال إدخال نص يحتوي على وسوم HTML مثل `<img src=x onerror=...>` قد ينفذ كـ DOM عند بناء الشارة | `btn.innerHTML = \`<span>${chip.label}</span>${getIcon('x', 14)}\`;` | استبدال `innerHTML` بـ `const span = document.createElement('span'); span.textContent = chip.label; btn.appendChild(span);` | تشغيل اختبار SEC-01 بحقن نص XSS في حقل البحث والتأكد من ظهوره كنص خام في الشارة دون تنفيذ |
| **SEC-FIND-02** | منخفضة / تعزيز (Low) | مثبتة (Proven) | `about.html:13-42` | وجود كتلة سكريبت مضمنة `<script type="module">` داخل صفحة `about.html` مع وجود ترويسة CSP تمنع السكريبتات المضمنة `script-src 'self'` | قد تحظر المتصفحات الصارمة تنفيذ كود الصفحة (تبديل اللغة، القائمة، العداد) لتعارضه مع CSP | وجود `<script type="module">` مضمن في `about.html` مع CSP لا تحوي `'unsafe-inline'` للسكريبتات | نقل منطق الصفحة إلى ملف مستقل `assets/js/about.js` واستدعاؤه عبر `<script type="module" src="assets/js/about.js"></script>` مع إضافته لكاش Service Worker | فحص Console في `about.html` والتأكد من غياب أي إنذار CSP |
| **SEC-FIND-03** | منخفضة / انضباط (Low) | مثبتة (Proven) | `assets/js/detail.js:370` | اسم الجهة `loc(opp.provider)` يوضع داخل `srcA.innerHTML` في لوحة المصدر | مخالفة مبدأ عزل البيانات الديناميكية عن `innerHTML` المنصوص عليه في القواعد | `srcA.innerHTML = \`<span>${loc(opp.provider)}</span>${getIcon('link', 15)}\`;` | استخدام `span.textContent = loc(opp.provider)` وإلحاقه بالعنصر عبر `appendChild` | التأكد من بناء عنصر الرابط نصيًا بالكامل |
| **SEC-FIND-04** | معلومة / آمن (Info) | متحقق منها | `service-worker.js:66` | طلبات الشبكة للروابط الخارجية | لا خطر؛ السيرفس ووركر يتحقق من `url.origin === self.location.origin` ويتجاهل الروابط الخارجية تمامًا | `if (url.origin !== self.location.origin) return;` | الإبقاء على السلوك الحالي | OFF-01 |
| **SEC-FIND-05** | معلومة / آمن (Info) | متحقق منها | `assets/js/common.js:33` | روابط التقديم والمصادر الخارجية | التحقق الصارم يرفض بروتوكولات `http:` و`javascript:` و`data:` ويرفض الروابط ذات بيانات الاعتماد (`username`/`password`) | فحص دالة `safeHTTPSUrl()` وتأكيد رفض الروابط المشبوهة | SEC-02 |
| **SEC-FIND-06** | معلومة / آمن (Info) | متحقق منها | `assets/js/common.js:68` | التخزين المحلي للمفضلة `LocalStorage` | لا يخزن سوى مصفوفة من المعرفات النصية المصرح بها، ويرفض البيانات المشوهة أو المعرفات غير الموجودة في البيانات | دالة `readSavedIds()` تفلتر المعرفات وفق `opportunitiesMap` فقط | FAV-02 |

---

## 2. خلاصة الحالات والتقييم النهائي

- **الثغرات الحرجة (Critical):** 0
- **الثغرات العالية (High):** 0
- **الملاحظات المتوسطة (Medium):** 1 (تم إثباتها في شارات الفلاتر النشطة، وتتطلب إصلاحًا فوريًا).
- **الملاحظات المنخفضة والتعزيز (Low/Hardening):** 2 (تعارض السكريبت المضمن مع CSP في `about.html`، وتنسيق اسم الجهة في `detail.js`).
- **حالة الأسرار والمفاتيح:** تم فحص كافة الملفات المعدة للنشر ولم يتم العثور على أي مفاتيح API، أو بيانات اعتماد، أو توكنز، أو إعدادات بيئة سرية.
- **حالة الروابط الخارجية:** جميع الروابط الخارجية تستخدم `rel="noopener noreferrer"` وتفتح في تبويب مستقل بعد التحقق من بروتوكول HTTPS.

---

## 3. خطة الإصلاح المطلوبة من المنفذ

1. تعديل `assets/js/list.js` لاستخدام `textContent` لشارات الفلاتر لمنع أي حقن عبر `innerHTML`.
2. استخراج سكريبت `about.html` إلى ملف مستقل `assets/js/about.js` وتحديث `service-worker.js` لتخزينه، لضمان الامتثال التام لـ CSP.
3. تعديل `assets/js/detail.js` لاستخدام `textContent` لاسم الجهة في لوحة المصدر.
4. تنفيذ الإصلاحات في commit مستقل، وتشغيل اختبارات التحقق من الأمان (SEC-01 و SEC-02).
