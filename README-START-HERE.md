# بوابة الفرص ٢ — الحزمة الرئيسية لـ Antigravity

**الإصدار: 2.0 — أُعدّت في 21 أكتوبر 2026.**

هذه حزمة تنفيذ المشروع الثاني بالتصميم الأبيض والبنفسجي والذهبي. تضم البيانات، ومرجع تصميم تفاعليًا بأصوله المحلية، وتعليمات البناء والاختبار والتسليم. يقرأها Antigravity ليبني التطبيق النهائي كاملًا.

## البدء في ثلاث خطوات

1. فك ضغط الحزمة في مجلد مستقل، وافتح مجلد `opportunity-gateway2-antigravity` نفسه بوصفه مشروعًا في تطبيق Antigravity المستقل.
2. انسخ محتوى `PASTE-INTO-ANTIGRAVITY.txt` إلى المحادثة. لا حاجة إلى لصق ملفات JSON أو إرفاقها واحدة واحدة بعد فتح المجلد.
3. راجع خطة التنفيذ عندما يطلب Antigravity مراجعتها، ثم دعه يكمل البناء والاختبارات. راجع `SUBMISSION-CHECKLIST.md` عند التسليم.

**المصدر الرئيسي للتنفيذ:** `ANTIGRAVITY_MASTER_PROMPT.md`.

## التغييرات المعتمدة

| البند | النسخة المعتمدة |
|---|---|
| تصنيفات الفرص | المنح الدراسية، والدورات المجانية فقط |
| البيانات | 20 سجلًا: 10 منح من القائمة الأصلية، و 10 دورات تقنية مجانية |
| التصميم | أبيض دافئ، بنفسجي عميق، لمسات ذهبية، خط Cairo محلي |
| الصفحات النهائية | الاستكشاف، التفاصيل، المفضلة، عن البوابة |
| اللغات | العربية أولًا مع الإنجليزية و RTL/LTR |
| الوظائف | البحث والفلاتر والمواعيد والمفضلة والعمل دون اتصال |

اختيرت المنح العشر بعد مراجعة المصادر بتاريخ الإعداد. الملف القديم كان يضع 11 سجلًا تحت `open`؛ استُبعد GKS من الاختيار لأن السجل العام لا يثبت مسارًا مفتوحًا بعينه للمتقدم المستهدف. لم نغيّر هذا إلى ادعاء بأن البرنامج مغلق عالميًا. إيراسموس سجل مظلة يتضمن برامج مفتوحة، وليس موعد تقديم موحدًا. التفاصيل في `SELECTION-AUDIT.md`.

مجانية **الدراسة** مؤكدة للدورات العشر وفق المصادر العامة. مجانية **الشهادة** موثقة بصورة منفصلة: شهادة CS50 تختلف عن شهادة edX المدفوعة؛ لا تُعرض شهادة Cisco أو NDG مجانية عندما لا يصرح المصدر بذلك.

## الملفات المهمة

| الملف أو المجلد | دوره |
|---|---|
| `ANTIGRAVITY_MASTER_PROMPT.md` | التعليمات الكاملة ومراحل التنفيذ ومعايير النهاية |
| `data/opportunities.json` | المصدر الوحيد لبيانات الفرص |
| `data/opportunities.schema.json` | عقد البيانات للمنح والدورات |
| `design-reference/` | التصميم الأخير، مع الخطوط و SVG ومعاينة تفاعلية للبيانات العشرين |
| `DESIGN-SPEC.md` | قرارات الشكل والسلوك وحدود المرجع البصري |
| `DATA-REVIEW.md` و`SOURCES.md` | نطاق التحقق ومصادر كل سجل |
| `SELECTION-AUDIT.md` | ما أُبقي من العشرين القديمة وما استُبعد ولماذا |
| `scripts/` | فحص البيانات والروابط والتقرير الأسبوعي وتحديث بيانات المعاينة |
| `briefs/` | مهام ثلاثة وكلاء، ثم وكيل دمج، ثم مراجع أمان للقراءة فقط |
| `templates/` | قوالب الأدلة واختبار مستخدم جديد والتأمل والفيديو |
| `SCHEDULED-TASK.md` | إنشاء مهمة أسبوعية فعلية لإنتاج تقرير فقط |
| `PACKAGE-QA.md` | ما فُحص داخل هذه الحزمة فعلًا |

## فحص الحزمة محليًا

من جذر الحزمة، باستخدام Node.js 20 أو أحدث:

```bash
node scripts/validate-opportunities.mjs
node scripts/build-design-data.mjs
node scripts/weekly-report.mjs
```

لفتح مرجع التصميم من خادم محلي، إن كانت Python متاحة:

```bash
python -m http.server 8000 --directory design-reference
```

ثم افتح `http://localhost:8000/`. المعاينة تشرح الشكل والتفاعلات؛ Antigravity مسؤول عن إنشاء صفحات الإنتاج الأربع و Service Worker وبقية متطلبات البرومبت.

## ما يتطلب تنفيذًا أثناء بناء المشروع

الحزمة جاهزة للإرسال. أما تسجيل الفيديو، والتجربة مع مستخدم جديد، والتأمل الشخصي، وتعليقات الطالب، والتحقق البشري من البيانات، وتفعيل الجدولة، والنشر النهائي فتُنجز أثناء تنفيذ المشروع في Antigravity. القوالب المرفقة ليست أدلة إنجاز. لا يجوز أن يملأ الوكيل أسماء أو توقيعات أو نتائج بشرية افتراضية.

## English handoff

Open the extracted folder in Antigravity and paste `PASTE-INTO-ANTIGRAVITY.txt`. Build the second Opportunity Gateway as a complete four-page static application. Use the supplied purple/white/gold reference and the single canonical dataset: ten retained scholarships plus ten free technology courses. Preserve source provenance, bilingual fields, and pending human-review status. The reference is a visual prototype; production implementation, actual testing, persistent scheduling, and deployment are required by the master prompt.
