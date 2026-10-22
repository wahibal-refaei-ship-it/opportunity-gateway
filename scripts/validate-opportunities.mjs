#!/usr/bin/env node
// Explicit, dependency-free validation of the version 2.0.0 data contract.
// This is not a general-purpose JSON Schema engine and performs no network I/O.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DATA_PATH = fileURLToPath(new URL('../data/opportunities.json', import.meta.url));
export const ORIGINAL_IDS = Object.freeze([
  'opp-001', 'opp-002', 'opp-004', 'opp-005', 'opp-006',
  'opp-007', 'opp-009', 'opp-010', 'opp-011', 'opp-018'
]);
export const STATUS_VALUES = Object.freeze(['open', 'closed', 'upcoming', 'under_review', 'self_paced']);

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateOrdinal(value) {
  if (!isISODate(value)) throw new TypeError(`Invalid calendar date: ${String(value)}`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / 86400000);
}

export function daysBetween(from, to) {
  return dateOrdinal(to) - dateOrdinal(from);
}

export function defaultAsOfDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Aden', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isIanaTimeZone(value) {
  if (typeof value !== 'string' || !/^(?:UTC|GMT|[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+)$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0)); return true; }
  catch { return false; }
}

export function parseHTTPSURL(value) {
  if (typeof value !== 'string' || value.trim() !== value || /[\s\\]/.test(value) || !/^https:\/\/[^/?#@\s\\]+(?:[/?#].*)?$/.test(value)) {
    throw new TypeError('Expected an absolute HTTPS URL without whitespace.');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new TypeError('Expected HTTPS with a hostname and no embedded username/password.');
  }
  return url;
}

export async function loadOpportunityData(path = DEFAULT_DATA_PATH) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

export function parseCommonArgs(argv, { extraValueOptions = [] } = {}) {
  const args = { data: DEFAULT_DATA_PATH, asOf: defaultAsOfDate(), help: false };
  const seen = new Set();
  const known = new Set(['--data', '--as-of', ...extraValueOptions]);
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === '--help' || option === '-h') { args.help = true; continue; }
    if (!known.has(option)) throw new TypeError(`Unknown option: ${option}`);
    if (seen.has(option)) throw new TypeError(`Repeated option: ${option}`);
    seen.add(option);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new TypeError(`Missing value for ${option}`);
    if (option === '--data') args.data = resolve(value);
    else if (option === '--as-of') args.asOf = value;
    else args[option.slice(2)] = value;
  }
  if (!isISODate(args.asOf)) throw new TypeError('--as-of must be a real calendar date in YYYY-MM-DD format.');
  return args;
}

export function validateOpportunities(data, { asOf = defaultAsOfDate() } = {}) {
  if (!isISODate(asOf)) throw new TypeError('asOf must be a real YYYY-MM-DD calendar date.');
  const errors = [];
  const warnings = [];
  const fail = (path, message) => errors.push({ path, message });
  const warn = (code, path, message, id) => warnings.push({ code, path, message, ...(id ? { id } : {}) });
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  function object(value, required, optional, path) {
    if (!isObject(value)) { fail(path, 'Expected an object.'); return false; }
    const allowed = new Set([...required, ...optional]);
    for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'Required field is missing.');
    for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key}`, 'Additional properties are not allowed.');
    return true;
  }
  function text(value, path) {
    if (typeof value !== 'string' || !value.trim()) { fail(path, 'Expected a nonempty string.'); return false; }
    return true;
  }
  function choice(value, values, path) {
    if (!values.includes(value)) { fail(path, `Expected one of: ${values.join(', ')}.`); return false; }
    return true;
  }
  function bilingual(value, path) {
    if (!object(value, ['ar', 'en'], [], path)) return;
    text(value.ar, `${path}.ar`); text(value.en, `${path}.en`);
  }
  function stringArray(value, path) {
    if (!Array.isArray(value) || value.length < 1) { fail(path, 'Expected a nonempty array of strings.'); return; }
    value.forEach((item, index) => text(item, `${path}[${index}]`));
    if (new Set(value).size !== value.length) fail(path, 'Array values must be unique.');
  }
  function date(value, path, nullable = false) {
    if (nullable && value === null) return true;
    if (!isISODate(value)) { fail(path, 'Expected a real YYYY-MM-DD calendar date.'); return false; }
    return true;
  }
  function https(value, path, nullable = false) {
    if (nullable && value === null) return;
    try { parseHTTPSURL(value); } catch (error) { fail(path, error.message); }
  }
  const metaFields = ['project', 'schema_version', 'prepared_at', 'record_count', 'scholarship_count', 'course_count', 'disclaimer'];
  if (!object(data, ['meta', 'opportunities'], [], '$')) return { valid: false, errors, warnings, asOf, counts: { records: 0, scholarships: 0, courses: 0 } };
  if (object(data.meta, metaFields, [], '$.meta')) {
    text(data.meta.project, '$.meta.project');
    if (data.meta.schema_version !== '2.0.0') fail('$.meta.schema_version', 'Expected schema version 2.0.0.');
    if (date(data.meta.prepared_at, '$.meta.prepared_at') && data.meta.prepared_at > asOf) {
      warn('future_preparation_date', '$.meta.prepared_at', `Preparation date is later than as-of date ${asOf}.`);
    }
    for (const [field, expected] of [['record_count', 20], ['scholarship_count', 10], ['course_count', 10]]) {
      if (data.meta[field] !== expected) fail(`$.meta.${field}`, `Expected ${expected}.`);
    }
    bilingual(data.meta.disclaimer, '$.meta.disclaimer');
  }
  if (!Array.isArray(data.opportunities)) {
    fail('$.opportunities', 'Expected an array.');
    return { valid: false, errors, warnings, asOf, counts: { records: 0, scholarships: 0, courses: 0 } };
  }
  const records = data.opportunities;
  const counts = {
    records: records.length,
    scholarships: records.filter((record) => record?.type === 'scholarship').length,
    courses: records.filter((record) => record?.type === 'course').length
  };
  if (counts.records !== 20) fail('$.opportunities', `Expected 20 records; received ${counts.records}.`);
  if (counts.scholarships !== 10) fail('$.opportunities', `Expected 10 scholarships; received ${counts.scholarships}.`);
  if (counts.courses !== 10) fail('$.opportunities', `Expected 10 courses; received ${counts.courses}.`);
  const ids = new Set();
  const slugs = new Set();
  const bilingualFields = ['title', 'provider', 'country', 'summary', 'description', 'eligibility', 'funding', 'status_scope', 'notes'];
  const recordFields = ['id', 'slug', 'type', ...bilingualFields, 'levels', 'fields', 'status', 'deadline', 'requirements', 'source_url', 'application_url', 'verified_at', 'verification_method', 'human_review', 'evidence', 'origin', 'display', 'course'];
  records.forEach((record, index) => {
    const path = `$.opportunities[${index}]`;
    if (!object(record, recordFields, [], path)) return;
    if (!text(record.id, `${path}.id`) || !/^(?:opp|course)-\d{3}$/.test(record.id)) fail(`${path}.id`, 'Expected opp-### or course-###.');
    if (ids.has(record.id)) fail(`${path}.id`, `Duplicate ID: ${record.id}.`);
    ids.add(record.id);
    if (!text(record.slug, `${path}.slug`) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)) fail(`${path}.slug`, 'Expected a lowercase slug with single hyphens.');
    if (slugs.has(record.slug)) fail(`${path}.slug`, `Duplicate slug: ${record.slug}.`);
    slugs.add(record.slug);
    choice(record.type, ['scholarship', 'course'], `${path}.type`);
    choice(record.status, STATUS_VALUES, `${path}.status`);
    bilingualFields.forEach((field) => bilingual(record[field], `${path}.${field}`));
    stringArray(record.levels, `${path}.levels`);
    stringArray(record.fields, `${path}.fields`);
    if (object(record.requirements, ['ar', 'en'], [], `${path}.requirements`)) {
      stringArray(record.requirements.ar, `${path}.requirements.ar`);
      stringArray(record.requirements.en, `${path}.requirements.en`);
    }
    https(record.source_url, `${path}.source_url`);
    https(record.application_url, `${path}.application_url`);
    if (date(record.verified_at, `${path}.verified_at`)) {
      const age = daysBetween(record.verified_at, asOf);
      if (age > 90) warn('stale_verification', `${path}.verified_at`, `Last automated source review is ${age} days old (over 90 days).`, record.id);
      if (age < 0) warn('future_verification', `${path}.verified_at`, `Source review date is later than as-of date ${asOf}.`, record.id);
    }
    if (record.verification_method !== 'automated_official_source_review') fail(`${path}.verification_method`, 'Expected automated_official_source_review.');
    if (object(record.deadline, ['type', 'opens_at', 'closes_at', 'closes_time', 'timezone', 'note'], [], `${path}.deadline`)) {
      const deadline = record.deadline;
      choice(deadline.type, ['fixed', 'course_specific', 'programme_specific', 'none'], `${path}.deadline.type`);
      date(deadline.opens_at, `${path}.deadline.opens_at`, true);
      date(deadline.closes_at, `${path}.deadline.closes_at`, true);
      if (deadline.closes_time !== null && (typeof deadline.closes_time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(deadline.closes_time))) fail(`${path}.deadline.closes_time`, 'Expected null or a valid HH:mm time.');
      if (deadline.timezone !== null && !isIanaTimeZone(deadline.timezone)) fail(`${path}.deadline.timezone`, 'Expected null or a supported IANA time-zone identifier.');
      bilingual(deadline.note, `${path}.deadline.note`);
      if (deadline.type === 'fixed' && !isISODate(deadline.closes_at)) fail(`${path}.deadline.closes_at`, 'A fixed deadline requires a closing date.');
      if (deadline.type === 'none') {
        for (const field of ['opens_at', 'closes_at', 'closes_time', 'timezone']) {
          if (deadline[field] !== null) fail(`${path}.deadline.${field}`, 'Must be null when deadline.type is none.');
        }
      }
      if (deadline.closes_time !== null && (!isISODate(deadline.closes_at) || !isIanaTimeZone(deadline.timezone))) fail(`${path}.deadline`, 'A closing time requires both a closing date and an IANA time zone.');
      if (isISODate(deadline.opens_at) && isISODate(deadline.closes_at) && deadline.opens_at > deadline.closes_at) fail(`${path}.deadline`, 'Opening date must not be later than closing date.');
      if (deadline.type === 'fixed' && isISODate(deadline.closes_at)) {
        const remaining = daysBetween(asOf, deadline.closes_at);
        if (remaining < 0 && record.status !== 'closed') warn('past_deadline', `${path}.deadline.closes_at`, `Fixed closing date is ${-remaining} day(s) in the past; recorded status was not changed.`, record.id);
        if (remaining >= 0 && remaining <= 14 && record.status !== 'closed') warn('deadline_within_14_days', `${path}.deadline.closes_at`, `Fixed closing date is in ${remaining} day(s). A same-day deadline is not automatically classified as expired.`, record.id);
      }
      if (isISODate(deadline.opens_at) && deadline.opens_at > asOf && record.status === 'open') warn('opening_in_future', `${path}.deadline.opens_at`, 'Recorded status is open but the stated opening date is in the future; review required.', record.id);
      if (isISODate(deadline.opens_at) && deadline.opens_at < asOf && record.status === 'upcoming') warn('opening_date_passed', `${path}.deadline.opens_at`, 'Recorded status is upcoming but its stated opening date has passed; review required.', record.id);
    }
    if (object(record.human_review, ['status', 'reviewed_at', 'reviewer'], [], `${path}.human_review`)) {
      const review = record.human_review;
      choice(review.status, ['pending', 'complete'], `${path}.human_review.status`);
      date(review.reviewed_at, `${path}.human_review.reviewed_at`, true);
      if (review.reviewer !== null) text(review.reviewer, `${path}.human_review.reviewer`);
      if (review.status === 'pending') {
        if (review.reviewed_at !== null || review.reviewer !== null) fail(`${path}.human_review`, 'Pending human review must have null reviewed_at and reviewer.');
        warn('human_review_pending', `${path}.human_review.status`, 'Human review remains pending; automated source review is not human verification.', record.id);
      }
      if (review.status === 'complete' && (!isISODate(review.reviewed_at) || typeof review.reviewer !== 'string' || !review.reviewer.trim())) fail(`${path}.human_review`, 'Completed human review requires a real review date and a named reviewer.');
      if (isISODate(review.reviewed_at) && review.reviewed_at > asOf) warn('future_human_review', `${path}.human_review.reviewed_at`, 'Human review date is later than the as-of date.', record.id);
    }
    if (!Array.isArray(record.evidence) || record.evidence.length < 1) fail(`${path}.evidence`, 'Expected at least one official-source evidence entry.');
    else record.evidence.forEach((evidence, evidenceIndex) => {
      const evidencePath = `${path}.evidence[${evidenceIndex}]`;
      if (!object(evidence, ['url', 'supports'], ['note'], evidencePath)) return;
      https(evidence.url, `${evidencePath}.url`);
      stringArray(evidence.supports, `${evidencePath}.supports`);
      if (Object.hasOwn(evidence, 'note')) text(evidence.note, `${evidencePath}.note`);
    });
    if (object(record.origin, ['kind', 'original_id'], [], `${path}.origin`)) {
      choice(record.origin.kind, ['retained_original', 'new_course'], `${path}.origin.kind`);
      if (record.origin.kind === 'retained_original') {
        if (!ORIGINAL_IDS.includes(record.origin.original_id)) fail(`${path}.origin.original_id`, 'Expected one of the ten retained original IDs.');
        if (record.origin.original_id !== record.id) fail(`${path}.origin.original_id`, 'The original ID must match the retained record ID exactly.');
      }
      if (record.origin.kind === 'new_course' && record.origin.original_id !== null) fail(`${path}.origin.original_id`, 'New courses must have null original_id.');
    }
    if (object(record.display, ['mark', 'color'], [], `${path}.display`)) {
      text(record.display.mark, `${path}.display.mark`);
      choice(record.display.color, ['violet', 'gold', 'teal', 'rose'], `${path}.display.color`);
    }
    if (record.type === 'scholarship') {
      if (!ORIGINAL_IDS.includes(record.id)) fail(`${path}.id`, 'Scholarships must retain exactly the approved original IDs.');
      if (record.course !== null) fail(`${path}.course`, 'Scholarships must have course: null.');
      if (record.origin?.kind !== 'retained_original') fail(`${path}.origin.kind`, 'Scholarships must use retained_original provenance.');
      if (record.status === 'self_paced') fail(`${path}.status`, 'Only courses may be self_paced.');
    }
    if (record.type === 'course') {
      if (typeof record.id !== 'string' || !/^course-\d{3}$/.test(record.id)) fail(`${path}.id`, 'New course IDs must use course-###.');
      if (record.origin?.kind !== 'new_course') fail(`${path}.origin.kind`, 'Courses must use new_course provenance.');
      const coursePath = `${path}.course`;
      if (object(record.course, ['free_access', 'content_languages', 'language_scope', 'duration', 'certificate', 'subfield', 'subfield_label'], [], coursePath)) {
        const course = record.course;
        if (course.free_access !== true) fail(`${coursePath}.free_access`, 'Every listed course must have confirmed free_access: true.');
        stringArray(course.content_languages, `${coursePath}.content_languages`);
        if (course.language_scope !== 'verified_subset') fail(`${coursePath}.language_scope`, 'Expected verified_subset; do not imply an exhaustive language list.');
        if (course.duration !== null && object(course.duration, ['value', 'unit', 'label'], [], `${coursePath}.duration`)) {
          if (typeof course.duration.value !== 'number' || !Number.isFinite(course.duration.value) || course.duration.value <= 0) fail(`${coursePath}.duration.value`, 'Expected a positive finite number.');
          choice(course.duration.unit, ['hours', 'curriculum_weeks'], `${coursePath}.duration.unit`);
          bilingual(course.duration.label, `${coursePath}.duration.label`);
        }
        if (object(course.certificate, ['status', 'label', 'details', 'source_url'], [], `${coursePath}.certificate`)) {
          choice(course.certificate.status, ['free', 'not_stated', 'paid', 'none'], `${coursePath}.certificate.status`);
          bilingual(course.certificate.label, `${coursePath}.certificate.label`);
          bilingual(course.certificate.details, `${coursePath}.certificate.details`);
          https(course.certificate.source_url, `${coursePath}.certificate.source_url`, true);
        }
        text(course.subfield, `${coursePath}.subfield`);
        bilingual(course.subfield_label, `${coursePath}.subfield_label`);
      }
    }
  });
  const retainedIds = records.filter((record) => record?.type === 'scholarship').map((record) => record.id);
  for (const id of ORIGINAL_IDS) if (!retainedIds.includes(id)) fail('$.opportunities', `Missing retained scholarship ID ${id}.`);
  return { valid: errors.length === 0, errors, warnings, asOf, counts };
}

export function isMainModule(moduleUrl) {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/validate-opportunities.mjs [--data PATH] [--as-of YYYY-MM-DD]\n\nChecks the explicit version 2.0.0 contract without dependencies or network requests.\nDefault --data: ../data/opportunities.json relative to this script.\nDefault --as-of: today in Asia/Aden. Warnings never modify data or recorded status.\nExit codes: 0 valid (warnings allowed), 1 invalid data, 2 input/read/JSON error.');
    return;
  }
  const result = validateOpportunities(await loadOpportunityData(args.data), { asOf: args.asOf });
  console.log(`Opportunity Gateway 2 — contract validation\nData: ${args.data}\nAs of: ${args.asOf} (calendar-date comparison; default zone Asia/Aden)\n`);
  console.log(`Records: ${result.counts.records}; scholarships: ${result.counts.scholarships}; courses: ${result.counts.courses}`);
  console.log(`Errors: ${result.errors.length}; warnings: ${result.warnings.length}`);
  for (const error of result.errors) console.error(`ERROR ${error.path}: ${error.message}`);
  for (const warning of result.warnings) console.log(`WARN [${warning.code}] ${warning.path}: ${warning.message}`);
  console.log(result.valid ? '\nPASS — explicit contract checks passed.' : '\nFAIL — correct the reported data errors.');
  console.log('HTTPS syntax checks do not establish that a page is live, free, or accepting applications. No data was modified.');
  process.exitCode = result.valid ? 0 : 1;
}

if (isMainModule(import.meta.url)) main().catch((error) => {
  console.error(`Validation could not run: ${error.message}`);
  process.exitCode = 2;
});
