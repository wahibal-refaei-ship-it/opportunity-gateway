# فهرس الأدلة — بوابة الفرص ٢

**تاريخ الفهرسة:** 2026-10-21  
**آخر commit:** `1332d6a`  
**البيئة:** Windows 11, Node.js v22.13.1

كل دليل مرتبط بمعرّف اختباره في `ACCEPTANCE-TESTS.md` ومرحلة التنفيذ في `TEST-REPORT.md`.

---

## أدلة وكيل أ — الاستكشاف والبحث والفلاتر

| الدليل | يدعم الاختبارات | commit | الوصف |
|---|---|---|---|
| [`evidence/agent-a/DATA-01-counts.txt`](../evidence/agent-a/DATA-01-counts.txt) | DATA-01 | `99646fb` | عدد السجلات: 20 = 10 منح + 10 دورات، ناتج `validate-opportunities.mjs` |
| [`evidence/agent-a/SEARCH-01-search.txt`](../evidence/agent-a/SEARCH-01-search.txt) | SEARCH-01 | `99646fb` | نتائج البحث العربي والإنجليزي والتطبيع (تشكيل، همزة، ألف) |
| [`evidence/agent-a/FILTER-01-composite.txt`](../evidence/agent-a/FILTER-01-composite.txt) | FILTER-01, FILTER-03, SORT-01, TIME-01 | `99646fb` | الفلترة المتراكبة AND، شارات الفلاتر، إعادة الضبط، الفرز، المواعيد القريبة |
| [`evidence/agent-a/FILTER-02-courses.txt`](../evidence/agent-a/FILTER-02-courses.txt) | FILTER-02 | `99646fb` | مرشحات الدورات (لغة المحتوى، شهادة مجانية) وعزلها عن المنح |
| [`evidence/agent-a/TIME-01-dates.txt`](../evidence/agent-a/TIME-01-dates.txt) | TIME-01, TIME-02, TIME-03 | `99646fb` | حساب الأيام المتبقية، المواعيد القريبة (opp-001: 11 يوم)، المواعيد حسب البرنامج |

---

## أدلة وكيل ب — التفاصيل والمفضلة

| الدليل | يدعم الاختبارات | commit | الوصف |
|---|---|---|---|
| [`evidence/agent-b/DETAIL-01-fields.txt`](../evidence/agent-b/DETAIL-01-fields.txt) | DETAIL-01, DATA-03 | `7cb2752` | اكتمال حقول التفاصيل، فصل المصدر عن التقديم، عرض الفحص الآلي |
| [`evidence/agent-b/COURSE-01-certificates.txt`](../evidence/agent-b/COURSE-01-certificates.txt) | COURSE-01 | `7cb2752` | فصل مجانية الدراسة عن الشهادة، CS50 مقابل edX المدفوعة، `not_stated` لا يُعرض كمجاني |
| [`evidence/agent-b/FAV-01-toggle.txt`](../evidence/agent-b/FAV-01-toggle.txt) | FAV-01 | `7cb2752` | الحفظ والإزالة الفورية، aria-pressed، الاستمرار بعد إعادة التحميل، مزامنة نوافذ متعددة |
| [`evidence/agent-b/FAV-02-resilience.txt`](../evidence/agent-b/FAV-02-resilience.txt) | FAV-02, SEC-02 | `7cb2752` | التعامل مع JSON تالف، رفض معرفات غير موجودة، اختبار safeHTTPSUrl |
| [`evidence/agent-b/NAV-01-invalid-id.txt`](../evidence/agent-b/NAV-01-invalid-id.txt) | NAV-01 | `7cb2752` | رسالة خطأ آمنة عند id مفقود أو خاطئ، زر العودة، لا حقن HTML |

---

## أدلة وكيل ج — PWA والعمل دون اتصال والجدولة والنشر

| الدليل | يدعم الاختبارات | commit | الوصف |
|---|---|---|---|
| [`evidence/agent-c/PWA-01-manifest.txt`](../evidence/agent-c/PWA-01-manifest.txt) | PWA-01 | `bc1422d` | صحة manifest.webmanifest، تسجيل Service Worker، الأيقونات المحلية |
| [`evidence/agent-c/OFF-01-offline-browsing.txt`](../evidence/agent-c/OFF-01-offline-browsing.txt) | OFF-01 | `bc1422d` | الصفحات الأربع والبيانات والأصول تعمل من الكاش دون إنترنت |
| [`evidence/agent-c/OFF-02-first-visit.txt`](../evidence/agent-c/OFF-02-first-visit.txt) | OFF-02 | `bc1422d` | حدود الزيارة الأولى: بدون تخزين مسبق لا تعمل الصفحات دون اتصال |
| [`evidence/agent-c/OFF-03-cache-update.txt`](../evidence/agent-c/OFF-03-cache-update.txt) | OFF-03 | `bc1422d` | تحديث الكاش يحذف `og2-cache-v0` دون المساس بالمفضلة أو كاشات أخرى |
| [`evidence/agent-c/SCHEDULE-01-report-run.txt`](../evidence/agent-c/SCHEDULE-01-report-run.txt) | SCHEDULE-01 | `bc1422d` | تشغيل `weekly-report.mjs`، SHA256 مطابق قبل وبعد، لا تعديل للبيانات |
| [`evidence/agent-c/DEPLOY-01-readiness.txt`](../evidence/agent-c/DEPLOY-01-readiness.txt) | DEPLOY-01 | `bc1422d` | جاهزية النشر: مسارات نسبية، `.nojekyll`، تعليمات GitHub Pages |

---

## ملخص التغطية

| قصة المستخدم | الاختبارات المرتبطة | حالة الدليل |
|---|---|---|
| U1 — البحث والفلاتر والمواعيد | SEARCH-01, FILTER-01, FILTER-03, SORT-01, TIME-01 | ✅ مكتمل |
| U2 — دورة مجانية وتمييز الشهادة | FILTER-02, COURSE-01, DETAIL-01 | ✅ مكتمل |
| U3 — تفاصيل منحة ومصدرها وحالتها | DETAIL-01, DATA-03, TIME-02, TIME-03, TIME-04 | ✅ مكتمل |
| U4 — حفظ الفرص والعمل دون اتصال | FAV-01, FAV-02, OFF-01, OFF-02, OFF-03 | ✅ مكتمل |
| U5 — العربية والإنجليزية وعرض 360px | UI-01, I18N-01, A11Y-01, A11Y-02, NAV-01 | ✅ مكتمل (فحص ساكِن؛ لقطات متصفح معلقة) |
