#!/usr/bin/env node
// Read-only Markdown report. No files are written and no messages are sent.
import {
  daysBetween, isMainModule, loadOpportunityData, parseCommonArgs,
  validateOpportunities
} from './validate-opportunities.mjs';

const TYPE_NAMES = { scholarship: 'منحة', course: 'دورة' };
const STATUS_NAMES = { open: 'متاحة وفق السجل', closed: 'مغلقة وفق السجل', upcoming: 'قادمة', under_review: 'قيد المراجعة', self_paced: 'تعلّم ذاتي' };
const escapeCell = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[\\`*_\[\]<>|]/g, '\\$&');
const sourceLink = (url) => `[المصدر الرسمي](<${new URL(url).href.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function fixedDaysRemaining(record, asOf) {
  return record.deadline.type === 'fixed' && record.deadline.closes_at
    ? daysBetween(asOf, record.deadline.closes_at)
    : null;
}

function renderTable(records, extraHeading, extraValue) {
  if (!records.length) return 'لا توجد سجلات في هذه الفئة.\n';
  const lines = [
    `| المعرّف | الفرصة | النوع | ${extraHeading} | المصدر |`,
    '| --- | --- | --- | --- | --- |'
  ];
  for (const record of records) lines.push(`| ${escapeCell(record.id)} | ${escapeCell(record.title.ar)} | ${TYPE_NAMES[record.type]} | ${escapeCell(extraValue(record))} | ${sourceLink(record.source_url)} |`);
  return `${lines.join('\n')}\n`;
}

export function buildWeeklyReport(current, { asOf, previous = null } = {}) {
  const validation = validateOpportunities(current, { asOf });
  if (!validation.valid) throw new TypeError(`Current data failed contract validation:\n${validation.errors.map((error) => `${error.path}: ${error.message}`).join('\n')}`);
  const reportDate = validation.asOf;
  if (previous !== null) {
    const previousCheck = validateOpportunities(previous, { asOf: reportDate });
    if (!previousCheck.valid) throw new TypeError(`Previous snapshot must also satisfy the version 2.0.0 contract:\n${previousCheck.errors.map((error) => `${error.path}: ${error.message}`).join('\n')}`);
  }
  const records = current.opportunities;
  const expired = records.filter((record) => record.status === 'closed' || (fixedDaysRemaining(record, reportDate) !== null && fixedDaysRemaining(record, reportDate) < 0));
  const closingSoon = records.filter((record) => {
    const days = fixedDaysRemaining(record, reportDate);
    return record.status !== 'closed' && days !== null && days >= 0 && days <= 14;
  }).sort((a, b) => a.deadline.closes_at.localeCompare(b.deadline.closes_at));
  const stale = records.filter((record) => daysBetween(record.verified_at, reportDate) > 90)
    .sort((a, b) => a.verified_at.localeCompare(b.verified_at));
  const pending = records.filter((record) => record.human_review.status === 'pending');
  const uncertainDates = records.filter((record) => ['course_specific', 'programme_specific'].includes(record.deadline.type));
  const lines = [
    '# تقرير المراجعة الأسبوعية — بوابة الفرص الثانية',
    '',
    `تاريخ التقرير: **${reportDate}**. تاريخ تجهيز البيانات: **${current.meta.prepared_at}**.`,
    '',
    `نطاق التقرير: ${records.length} سجلًا، منها ${validation.counts.scholarships} منح و${validation.counts.courses} دورات.`,
    '',
    'هذا تقرير قراءة فقط للبيانات الحالية. لا يفحص صفحات الويب، ولا يعدّل حالة الفرص، ولا يرسل رسائل أو ينشئ ملفات.',
    '',
    'تُحسب المواعيد الثابتة بالمقارنة بين التواريخ، لا بحسب ساعة تنفيذ التقرير. الموعد الذي ينتهي في تاريخ التقرير يُدرج ضمن القريب؛ لا يُصنّف منتهيًا تلقائيًا في اليوم نفسه. التفاصيل الدقيقة للساعة والمنطقة الزمنية تبقى في السجل.',
    '',
    '## ملخص المراجعة',
    '',
    '| الفئة | العدد |',
    '| --- | ---: |',
    `| منتهية بتاريخ ثابت أو مسجلة مغلقة | ${expired.length} |`,
    `| تنتهي خلال 14 يومًا، بما فيها اليوم | ${closingSoon.length} |`,
    `| آخر فحص آلي أقدم من 90 يومًا | ${stale.length} |`,
    `| مراجعة بشرية معلقة | ${pending.length} |`,
    `| مواعيد تختلف بحسب البرنامج أو الدورة | ${uncertainDates.length} |`,
    '',
    '## المنتهية أو المسجلة مغلقة',
    '',
    renderTable(expired, 'سبب الإدراج', (record) => {
      const days = fixedDaysRemaining(record, reportDate);
      return days !== null && days < 0
        ? `الموعد الثابت ${record.deadline.closes_at} مضى منذ ${-days} يوم؛ الحالة المسجلة: ${STATUS_NAMES[record.status]}`
        : STATUS_NAMES[record.status];
    }),
    '## المواعيد القريبة — 14 يومًا',
    '',
    renderTable(closingSoon, 'الموعد والمدة المتبقية', (record) => `${record.deadline.closes_at} — ${fixedDaysRemaining(record, reportDate)} يوم`),
    '## السجلات المتغيرة مقارنة بلقطة سابقة',
    ''
  ];
  if (previous === null) {
    lines.push('لم تُقدَّم لقطة سابقة، لذلك لا يمكن استنتاج السجلات التي تغيّرت. للمقارنة، مرّر ملفًا سابقًا بالعقد نفسه باستخدام `--previous PATH`.', '');
  } else {
    const before = new Map(previous.opportunities.map((record) => [record.id, record]));
    const now = new Map(records.map((record) => [record.id, record]));
    const changes = [];
    for (const record of records) {
      const old = before.get(record.id);
      if (!old) changes.push({ record, description: 'سجل مضاف في البيانات الحالية' });
      else {
        const fields = [...new Set([...Object.keys(old), ...Object.keys(record)])]
          .filter((field) => stable(old[field]) !== stable(record[field])).sort();
        if (fields.length) changes.push({ record, description: `حقول تغيّرت: ${fields.join(', ')}` });
      }
    }
    for (const record of previous.opportunities) if (!now.has(record.id)) changes.push({ record, description: 'سجل موجود في اللقطة السابقة وغير موجود حاليًا' });
    lines.push(`المقارنة بين بيانات جُهزت في ${previous.meta.prepared_at} والبيانات الحالية. هذه فروق بين ملفين؛ لا تثبت أن الجهة الخارجية غيّرت برنامجها.`, '');
    if (!changes.length) lines.push('لا توجد فروق بين سجلات اللقطتين.', '');
    else {
      lines.push('| المعرّف | الفرصة | الفرق |', '| --- | --- | --- |');
      for (const change of changes) lines.push(`| ${escapeCell(change.record.id)} | ${escapeCell(change.record.title.ar)} | ${escapeCell(change.description)} |`);
      lines.push('');
    }
  }
  lines.push(
    '## الفحص الآلي الأقدم من 90 يومًا',
    '',
    renderTable(stale, 'تاريخ الفحص وعمره', (record) => `${record.verified_at} — ${daysBetween(record.verified_at, reportDate)} يوم`),
    '## المراجعة البشرية المعلقة',
    '',
    'هذه السجلات لم تستكمل مراجعة بشرية في البيانات. تاريخ الفحص الآلي للمصدر لا يُعد تاريخ مراجعة بشرية.',
    '',
    renderTable(pending, 'آخر فحص آلي للمصدر', (record) => record.verified_at),
    '## المواعيد التي تحتاج مراجعة على مستوى البرنامج',
    '',
    renderTable(uncertainDates, 'نطاق الموعد', (record) => record.deadline.note.ar),
    '## تنبيهات اتساق التواريخ',
    ''
  );
  const timingWarnings = validation.warnings.filter((warning) => [
    'future_preparation_date', 'future_verification', 'future_human_review',
    'opening_in_future', 'opening_date_passed'
  ].includes(warning.code));
  if (!timingWarnings.length) lines.push('لا توجد تنبيهات إضافية بشأن اتساق تواريخ الفتح والفحص.');
  else for (const warning of timingWarnings) lines.push(`- ${escapeCell(warning.id || 'meta')}: ${escapeCell(warning.message)}`);
  lines.push('', 'حدود التقرير: نجاح التحقق البنيوي لا يؤكد أن رابطًا يعمل، أو أن التقديم مفتوح، أو أن شرطًا خارجيًا لم يتغير.', '');
  return lines.join('\n');
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), { extraValueOptions: ['--previous'] });
  if (args.help) {
    console.log('Usage: node scripts/weekly-report.mjs [--data PATH] [--as-of YYYY-MM-DD] [--previous PATH]\n\nPrints Markdown to stdout only. No file writes, network requests or messages.\nPrevious snapshots must satisfy the same version 2.0.0 data contract.\nWithout --previous, changes are explicitly reported as unknown.\nOnly fixed closing dates drive expiry and the inclusive 0–14 day window.\nDefault date: today in Asia/Aden. Dates are compared at calendar-day precision.');
    return;
  }
  const current = await loadOpportunityData(args.data);
  const previous = args.previous ? await loadOpportunityData(args.previous) : null;
  process.stdout.write(buildWeeklyReport(current, { asOf: args.asOf, previous }));
}

if (isMainModule(import.meta.url)) main().catch((error) => {
  console.error(`Weekly report could not run: ${error.message}`);
  process.exitCode = 1;
});
