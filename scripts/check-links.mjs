#!/usr/bin/env node
// OPTIONAL network check: executes only when explicitly invoked, never on import.
// Does not change data, confirm free access, log in or send messages.
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  isMainModule, loadOpportunityData, parseCommonArgs, parseHTTPSURL,
  validateOpportunities
} from './validate-opportunities.mjs';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_BODY_BYTES = 32768;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_CONCURRENCY = 3;

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => value * 256 + Number(part), 0);
}

function ipv4In(address, base, bits) {
  const scale = 2 ** (32 - bits);
  return Math.floor(ipv4Number(address) / scale) === Math.floor(ipv4Number(base) / scale);
}

function ipv6Number(address) {
  const halves = address.toLowerCase().split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return parts.reduce((value, part) => (value << 16n) + BigInt('0x' + part), 0n);
}

function ipv6In(addressNumber, base, bits) {
  const shift = BigInt(128 - bits);
  return (addressNumber >> shift) === (ipv6Number(base) >> shift);
}

// Conservative public-unicast policy: deny private, local, documentation,
// multicast and selected special-use/transition addresses.
export function isPublicIPAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const denied = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
      ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
      ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
    ];
    return !denied.some(([base, bits]) => ipv4In(address, base, bits));
  }
  if (family === 6) {
    // Decline IPv4-mapped/translation and zone-scoped forms.
    if (address.includes('.') || address.includes('%')) return false;
    const number = ipv6Number(address);
    if (!ipv6In(number, '2000::', 3)) return false;
    return ![
      ['2001::', 32], ['2001:2::', 48], ['2001:10::', 28],
      ['2001:20::', 28], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]
    ].some(([base, bits]) => ipv6In(number, base, bits));
  }
  return false;
}

export function isPublicHostname(hostname) {
  if (typeof hostname !== 'string') return false;
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (isIP(host)) return isPublicIPAddress(host);
  if (!host.includes('.') || host.length > 253 || !/^[a-z0-9.-]+$/.test(host)) return false;
  if (host.split('.').some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return false;
  return ![
    'localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home',
    'home.arpa', 'corp', 'test', 'invalid', 'example', 'onion'
  ].some((suffix) => host === suffix || host.endsWith('.' + suffix));
}

function remainingMs(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('Overall URL-check timeout reached.');
  return remaining;
}

async function beforeTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS resolution timed out.')), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

async function resolvePublicTarget(url, deadline) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!isPublicHostname(hostname)) throw new Error('Blocked non-public hostname or IP address.');
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await beforeTimeout(lookup(hostname, { all: true, verbatim: true }), remainingMs(deadline));
  if (!addresses.length || addresses.some((entry) => !isPublicIPAddress(entry.address))) {
    throw new Error('Blocked DNS result containing a non-public IP address.');
  }
  // Pin the approved address to prevent a second DNS resolution from changing
  // the checked public target to a private address.
  const chosen = addresses.find((entry) => entry.family === 4) || addresses[0];
  return { hostname, chosen };
}

async function requestOnce(url, method, deadline) {
  const { hostname, chosen } = await resolvePublicTarget(url, deadline);
  const timeoutMs = remainingMs(deadline);
  return new Promise((resolve, reject) => {
    let timer;
    let finished = false;
    let response;
    const settle = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
      response?.destroy();
    };
    const request = https.request(url, {
      method,
      agent: false,
      family: chosen.family,
      servername: isIP(hostname) ? '' : hostname,
      lookup: (_host, options, callback) => {
        if (typeof options === 'function') { callback = options; options = {}; }
        if (options?.all) callback(null, [chosen]);
        else callback(null, chosen.address, chosen.family);
      },
      headers: {
        'User-Agent': 'OpportunityGatewayLinkReview/2.0 (public URL reachability check)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.5',
        'Accept-Encoding': 'identity',
        ...(method === 'GET' ? { Range: 'bytes=0-' + (MAX_BODY_BYTES - 1) } : {})
      }
    }, (res) => {
      response = res;
      const result = { status: res.statusCode || 0, headers: res.headers, body: '' };
      const html = /text\/html|application\/xhtml\+xml/i.test(String(res.headers['content-type'] || ''));
      if (method === 'HEAD' || !html || result.status < 200 || result.status >= 300) {
        settle(null, result);
        return;
      }
      const chunks = [];
      let size = 0;
      const complete = () => settle(null, { ...result, body: Buffer.concat(chunks).toString('utf8') });
      res.on('data', (chunk) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const part = bytes.subarray(0, MAX_BODY_BYTES - size);
        chunks.push(part);
        size += part.length;
        if (size >= MAX_BODY_BYTES) complete();
      });
      res.on('end', complete);
      res.on('error', (error) => settle(error));
    });
    timer = setTimeout(() => {
      const error = new Error('Overall URL-check timeout reached.');
      settle(error);
      request.destroy(error);
    }, timeoutMs);
    request.on('error', (error) => settle(error));
    request.end();
  });
}

function looksLikeLoginURL(url) {
  return /(?:^|[/. _-])(?:login|log-in|log_in|signin|sign-in|sign_in|sso|oauth|authenticate)(?:$|[/. _-])/i.test(url.hostname + url.pathname);
}

function looksLikeReviewPage(body) {
  const title = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return /sign\s*in|log\s*in|login|access\s*denied|just\s*a\s*moment|verify\s*(?:you|your)|attention\s*required|security\s*check/i.test(title)
    || /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(body);
}

export async function checkURL(value, { timeoutMs = DEFAULT_TIMEOUT_MS, maxRedirects = DEFAULT_MAX_REDIRECTS } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new TypeError('timeoutMs must be an integer from 1000 to 60000.');
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) throw new TypeError('maxRedirects must be an integer from 0 to 10.');
  const deadline = Date.now() + timeoutMs;
  let current;
  let redirectCount = 0;
  let status = null;
  const outcome = (result, reason) => ({
    url: value, final_url: current?.href || value, http_status: status,
    outcome: result, reason, redirects: redirectCount
  });
  try {
    current = parseHTTPSURL(value);
    current.hash = '';
    if (looksLikeLoginURL(current)) return outcome('review', 'Sign-in URL: access conditions require review; no login attempted.');
    const visit = async (method) => {
      const seen = new Set();
      while (true) {
        if (seen.has(current.href)) throw new Error('Redirect loop detected.');
        seen.add(current.href);
        const result = await requestOnce(current, method, deadline);
        status = result.status;
        if (!REDIRECT_STATUSES.has(status)) return result;
        if (!result.headers.location) throw new Error('Redirect response has no Location header.');
        if (redirectCount >= maxRedirects) throw new Error('Redirect limit reached.');
        const next = new URL(result.headers.location, current);
        // Every hop independently remains HTTPS, credential-free and public.
        current = parseHTTPSURL(next.href);
        current.hash = '';
        redirectCount += 1;
        if (looksLikeLoginURL(current)) throw new Error('Redirected to sign-in; access requires review. No login attempted.');
      }
    };
    let result = await visit('HEAD');
    // Fallback for unsupported HEAD. Also sample successful HTML with a
    // bounded GET to flag visible sign-in and browser-challenge pages.
    const html = /text\/html|application\/xhtml\+xml/i.test(String(result.headers['content-type'] || ''));
    if ([405, 501].includes(status) || (status >= 200 && status < 300 && html)) result = await visit('GET');
    if ([401, 403].includes(status)) return outcome('review', 'HTTP ' + status + ': authentication or access restriction; do not infer a closed opportunity.');
    if (status === 429) return outcome('review', 'HTTP 429: rate limited; no retry loop and no opportunity status change.');
    if ([404, 410].includes(status)) return outcome('review', 'HTTP ' + status + ': link needs review; this is not evidence that the programme is closed.');
    if (status >= 200 && status < 300) {
      if (looksLikeReviewPage(result.body)) return outcome('review', 'Possible sign-in or browser challenge in bounded HTML sample; manual review needed.');
      return outcome('reachable', 'HTTP response succeeded. This does not verify content, free access, eligibility or application availability.');
    }
    return outcome('review', 'HTTP ' + status + ': response needs review; opportunity status is unchanged.');
  } catch (error) {
    return outcome('review', String(error.message || error));
  }
}

export function collectPrincipalLinks(data) {
  const links = new Map();
  for (const record of data.opportunities) {
    for (const field of ['source_url', 'application_url']) {
      const url = parseHTTPSURL(record[field]);
      url.hash = '';
      const entry = links.get(url.href) || { url: url.href, uses: [] };
      entry.uses.push(record.id + ':' + field);
      links.set(url.href, entry);
    }
  }
  return [...links.values()];
}

const escapeCell = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[\\\x60*_\[\]<>|]/g, '\\$&');
const linkCell = (value) => '[الرابط](<' + value.replace(/</g, '%3C').replace(/>/g, '%3E') + '>)';

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), {
    extraValueOptions: ['--timeout-ms', '--max-redirects', '--concurrency']
  });
  if (args.help) {
    console.log('Usage: node scripts/check-links.mjs [--data PATH] [--as-of YYYY-MM-DD] [--timeout-ms 10000] [--max-redirects 5] [--concurrency 3]\n\nOPTIONAL NETWORK CHECK: makes HTTPS requests only when explicitly run.\nPrints Markdown to stdout; does not write data, log in or send messages.\nChecks distinct source_url/application_url values; evidence/certificate URLs are outside scope.\nTimeout is shared across DNS, redirects and bounded GET for each URL.\nTimeout: 1000-60000 ms; redirects: 0-10; concurrency: 1-8.\nBlocks HTTP, credentials and private/special-use hosts on every request, with DNS address pinning.\nHEAD first; bounded GET for 405/501 or successful HTML. No JavaScript execution or cookies.\n403/429/sign-in/challenge/errors require review and never mark opportunities closed.\nA successful response proves only HTTP reachability, not content or availability.\nExit 0: report completed, including review outcomes. Exit 1: invalid data; exit 2: input or execution error.');
    return;
  }
  const integerOption = (name, fallback, min, max) => {
    if (args[name] === undefined) return fallback;
    if (!/^\d+$/.test(args[name])) throw new TypeError('--' + name + ' must be an integer.');
    const value = Number(args[name]);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError('--' + name + ' must be between ' + min + ' and ' + max + '.');
    return value;
  };
  const timeoutMs = integerOption('timeout-ms', DEFAULT_TIMEOUT_MS, 1000, 60000);
  const maxRedirects = integerOption('max-redirects', DEFAULT_MAX_REDIRECTS, 0, 10);
  const concurrency = integerOption('concurrency', DEFAULT_CONCURRENCY, 1, 8);
  const data = await loadOpportunityData(args.data);
  const validation = validateOpportunities(data, { asOf: args.asOf });
  if (!validation.valid) {
    console.error('No requests made: data failed contract validation.\n' + validation.errors.map((error) => error.path + ': ' + error.message).join('\n'));
    process.exitCode = 1;
    return;
  }
  const links = collectPrincipalLinks(data);
  const results = Array(links.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < links.length) {
      const index = cursor++;
      const entry = links[index];
      results[index] = { ...await checkURL(entry.url, { timeoutMs, maxRedirects }), uses: entry.uses };
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, links.length) }, worker));
  const reachable = results.filter((result) => result.outcome === 'reachable').length;
  const lines = [
    '# تقرير فحص الروابط الاختياري — بوابة الفرص الثانية',
    '',
    'وقت الفحص الآلي: ' + new Date().toISOString() + '. مرجع التحقق من البيانات: ' + args.asOf + '.',
    '',
    'فُحص ' + results.length + ' رابطًا رئيسيًا مميزًا: ' + reachable + ' استجابة HTTP ناجحة، و' + (results.length - reachable) + ' نتيجة تحتاج مراجعة.',
    '',
    'الفحص مقتصر على source_url وapplication_url. لا يفحص روابط الأدلة والشهادات، ولا يعدّل أي سجل أو تاريخ تحقق.',
    '',
    'نتائج 403 و429 وصفحات الدخول والعوائق التقنية تعني الحاجة إلى مراجعة؛ لا تعني إغلاق الفرصة. النجاح يعني استجابة HTTP فقط، ولا يثبت المجانية أو الأهلية أو إتاحة التقديم. عينة HTML محدودة ولا يُنفَّذ JavaScript.',
    '',
    '| الرابط | السجلات والحقول | HTTP | النتيجة | التحويلات | الملاحظة |',
    '| --- | --- | ---: | --- | ---: | --- |'
  ];
  for (const result of results) {
    lines.push('| ' + linkCell(result.url) + ' | ' + escapeCell(result.uses.join(', ')) + ' | ' + (result.http_status ?? '—') + ' | ' + (result.outcome === 'reachable' ? 'استجابة ناجحة' : 'مراجعة مطلوبة') + ' | ' + result.redirects + ' | ' + escapeCell(result.reason) + ' |');
  }
  lines.push('', 'حدود التنفيذ: ' + timeoutMs + ' مللي ثانية لكل رابط، وبحد أقصى ' + maxRedirects + ' تحويلات و' + concurrency + ' فحوص متزامنة.', '', 'لم تُعدّل البيانات ولم تُرسَل رسائل. يُعاد رمز خروج 0 عند اكتمال التقرير حتى لو احتوى نتائج تحتاج مراجعة.', '');
  process.stdout.write(lines.join('\n'));
}

if (isMainModule(import.meta.url)) main().catch((error) => {
  console.error('Optional link check could not run: ' + error.message);
  process.exitCode = 2;
});
