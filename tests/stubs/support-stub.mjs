/**
 * QA stub for ติดต่อทีมผู้พัฒนา (`/backend/help/support`), registered by `stub-server.mjs` on :3301.
 * Paired with `.env.stub`. Feature: `claude_planning/feature/20261005_2218_admin_support_discord_relay`.
 *
 * Two routes the screen calls and the stub did not have:
 *   - GET  /api/v1/system/health            — every role, ROLE-SHAPED like the real one: SUPER_ADMIN
 *                                             gets `detail: 'FULL'` and `telemetry`, ADMIN and VIEWER
 *                                             get `detail: 'SUMMARY'` and `telemetry: null`.
 *   - POST /api/v1/system/support/incident  — every role (`@Roles(SUPER_ADMIN, ADMIN, VIEWER)`),
 *                                             multipart, `@HttpCode(200)`.
 *
 * ⚠️ IT MIRRORS `@Roles`, THE DTO SHAPES AND THE REAL CHECK ORDER OF `easybook-service`, because a
 * permissive stub fakes a PASS and an unfaithful shape fakes a FAIL (both have cost cycles here):
 *   1. `x-csrf-token` must equal `stub-csrf-token`, else 403 `Invalid CSRF token.` (before anything).
 *   2. Multer's refusals: a file over 5 MiB → 413 `SUPPORT_FILE_TOO_LARGE`; a 4th file → uncoded 400
 *      `Too many files`.
 *   3. DTO validation → UNCODED 400 whose `message` is a `string[]` (category / severity enum, empty or
 *      over-long path / description, over-long diagnostics).
 *   4. Handler: webhook not configured → 503 `SUPPORT_NOT_CONFIGURED`; a file whose BYTES are not PNG /
 *      JPEG / WEBP → 400 `SUPPORT_FILE_TYPE_UNSUPPORTED` (the declared type is ignored); combined size
 *      over 9.5 MiB → 413 `SUPPORT_ATTACHMENTS_TOO_LARGE`; more than 5 in 10 min for the same role →
 *      429 `SUPPORT_RATE_LIMITED`; then the "relay".
 *   Success is 200 `{ success: true, code: 'INC-1001', timestamp }` with the number rising per call.
 *
 * THERE IS NO DISCORD HERE, OF ANY KIND: nothing leaves this process. The "relay" is a log line in
 * memory, so the preview card and the toast can be reviewed without a webhook. The real URL is a
 * backend secret and has no business in this repository.
 *
 * Every accepted report is LOGGED with the role it was answered under, its fields and the NAME, SIZE
 * and sniffed type of each file — so "what did the browser actually send" is read from
 * `GET /__control/support/log` rather than assumed.
 *
 * Controls (`POST /__control/support`, body keys all optional):
 *   healthMode  ok | degraded | not-configured | unreachable | slow
 *                                          (degraded = DB DOWN; not-configured = LINE + R2 NOT_CONFIGURED;
 *                                           unreachable = uncoded 503 on /system/health)
 *   quotaMode   ok | unlimited              (LINE `quotaTotal`: 1000 with 850 left · null)
 *   submitMode  ok | relay-failed | not-configured | too-large | slow
 *                                          (relay-failed = 502 · not-configured = 503 ·
 *                                           too-large = Discord answered 413 → our 413 ATTACHMENTS)
 *   reset       true                        (modes, the sequence, the rate windows and the log)
 * `GET /__control/support/log` lists the accepted reports; `DELETE /__control/support/log` clears it.
 */

import express from 'express';

const MIB = 1024 * 1024;
const FILE_MAX = 5 * MIB;
const BUDGET = 9.5 * MIB;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60_000;

const CATEGORIES = ['web', 'line', 'booking', 'access', 'other'];
const SEVERITIES = ['normal', 'urgent', 'critical'];

const MSG = {
  SUPPORT_NOT_CONFIGURED: 'ระบบแจ้งปัญหายังไม่พร้อมใช้งาน กรุณาติดต่อทีมพัฒนาผ่าน Discord',
  SUPPORT_RELAY_FAILED:
    'ส่งแจ้งปัญหาถึงทีมพัฒนาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือติดต่อทีมพัฒนาผ่าน Discord',
  SUPPORT_RATE_LIMITED: 'ส่งแจ้งปัญหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  SUPPORT_FILE_TYPE_UNSUPPORTED: 'ไฟล์แนบต้องเป็นภาพ PNG, JPG หรือ WEBP เท่านั้น',
  SUPPORT_FILE_TOO_LARGE: 'ไฟล์ภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 5 MB',
  SUPPORT_ATTACHMENTS_TOO_LARGE:
    'ภาพหน้าจอรวมกันมีขนาดใหญ่เกินกว่าที่ส่งถึงทีมพัฒนาได้ กรุณาลดจำนวนหรือขนาดภาพแล้วลองใหม่',
};
const STATUS_NAME = { 400: 'Bad Request', 413: 'Payload Too Large', 429: 'Too Many Requests', 502: 'Bad Gateway', 503: 'Service Unavailable' };

const coded = (res, status, code) =>
  res.status(status).json({ statusCode: status, error: STATUS_NAME[status], message: MSG[code], code });

/** Magic-byte sniff, as `sniffImageType` does on the server. A 0-byte file is `null`. */
function sniff(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** A just-enough multipart/form-data parser: `{ fields, files }`. No multer in this stub. */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  if (!m) return null;
  const delimiter = Buffer.from(`--${m[1] ?? m[2]}`);
  const fields = {};
  const files = [];
  let pos = buf.indexOf(delimiter);
  while (pos !== -1) {
    const start = pos + delimiter.length;
    if (buf.subarray(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(delimiter, start);
    if (next === -1) break;
    // Strip the CRLF after the delimiter and the CRLF before the next one.
    const part = buf.subarray(start + 2, next - 2);
    const split = part.indexOf('\r\n\r\n');
    if (split !== -1) {
      const head = part.subarray(0, split).toString('utf8');
      const body = part.subarray(split + 4);
      const name = /name="([^"]*)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      if (name) {
        if (filename !== undefined) files.push({ name, filename, buffer: body });
        else (fields[name] ??= []).push(body.toString('utf8'));
      }
    }
    pos = next;
  }
  return { fields, files };
}

export function registerSupport(app, { getRole, csrfToken }) {
  let healthMode = 'ok';
  let quotaMode = 'ok';
  let submitMode = 'ok';
  let seq = 1000;
  let windows = new Map();
  let log = [];

  const reset = () => {
    healthMode = 'ok';
    quotaMode = 'ok';
    submitMode = 'ok';
    seq = 1000;
    windows = new Map();
    log = [];
  };
  const state = () => ({ healthMode, quotaMode, submitMode, accepted: log.length, nextCode: `INC-${seq + 1}` });

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ── GET /system/health: every role, shaped by role ───────────────────── */
  app.get('/api/v1/system/health', async (_req, res) => {
    if (healthMode === 'slow') await delay(2500);
    if (healthMode === 'unreachable') {
      return res.status(503).json({ statusCode: 503, error: 'Service Unavailable', message: 'Service temporarily unavailable.' });
    }
    const role = getRole();
    const full = role === 'SUPER_ADMIN';
    const db = healthMode === 'degraded' ? 'DOWN' : 'UP';
    const other = healthMode === 'not-configured' ? 'NOT_CONFIGURED' : 'UP';
    const now = new Date().toISOString();
    res.json({
      checkedAt: now,
      overall: db === 'DOWN' ? 'DEGRADED' : 'OK',
      detail: full ? 'FULL' : 'SUMMARY',
      services: { database: { status: db }, line: { status: other }, storage: { status: other } },
      telemetry: full
        ? {
            database: { latencyMs: 12 },
            line:
              other === 'UP'
                ? quotaMode === 'unlimited'
                  ? { quotaTotal: null, quotaUsed: null, quotaRemaining: null, observedAt: now }
                  : { quotaTotal: 1000, quotaUsed: 150, quotaRemaining: 850, observedAt: now }
                : { quotaTotal: null, quotaUsed: null, quotaRemaining: null, observedAt: null },
            storage: { latencyMs: other === 'UP' ? 84 : null, observedAt: other === 'UP' ? now : null },
          }
        : null,
    });
  });

  /* ── POST /system/support/incident ─────────────────────────────────────── */
  app.post(
    '/api/v1/system/support/incident',
    // 1. CSRF, before everything — as the real middleware.
    (req, res, next) => {
      if (req.get('x-csrf-token') !== csrfToken) {
        return res.status(403).json({ statusCode: 403, error: 'Forbidden', message: 'Invalid CSRF token.' });
      }
      next();
    },
    express.raw({ type: 'multipart/form-data', limit: '40mb' }),
    async (req, res) => {
      const parsed = Buffer.isBuffer(req.body) ? parseMultipart(req.body, req.get('content-type')) : null;
      if (!parsed) {
        return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Multipart form data expected' });
      }
      const { fields, files } = parsed;
      const one = (k) => fields[k]?.[0];

      // 2. Multer.
      const stray = files.find((f) => f.name !== 'files');
      if (stray) return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Unexpected field' });
      if (files.length > 3) return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'Too many files' });
      if (files.some((f) => f.buffer.length > FILE_MAX)) return coded(res, 413, 'SUPPORT_FILE_TOO_LARGE');

      // 3. The DTO (global pipe): UNCODED, `message` is a string[].
      const trim = (s) => (typeof s === 'string' ? s.trim() : s);
      const problems = [];
      const category = one('category');
      const severity = one('severity');
      const path = trim(one('path'));
      const description = trim(one('description'));
      const diagnostics = trim(one('diagnostics'));
      if (!CATEGORIES.includes(category)) problems.push(`category must be one of the following values: ${CATEGORIES.join(', ')}`);
      if (!SEVERITIES.includes(severity)) problems.push(`severity must be one of the following values: ${SEVERITIES.join(', ')}`);
      if (!path) problems.push('path should not be empty');
      else if (path.length > 200) problems.push('path must be shorter than or equal to 200 characters');
      if (!description) problems.push('description should not be empty');
      else if (description.length > 1000) problems.push('description must be shorter than or equal to 1000 characters');
      if (diagnostics && diagnostics.length > 2000) problems.push('diagnostics must be shorter than or equal to 2000 characters');
      const known = new Set(['category', 'severity', 'path', 'description', 'diagnostics']);
      for (const k of Object.keys(fields)) if (!known.has(k)) problems.push(`property ${k} should not exist`);
      if (problems.length) {
        return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: problems });
      }

      // 4. The handler, in the design's order.
      if (submitMode === 'not-configured') return coded(res, 503, 'SUPPORT_NOT_CONFIGURED');
      const sniffed = files.map((f) => sniff(f.buffer));
      if (sniffed.some((t) => t === null)) return coded(res, 400, 'SUPPORT_FILE_TYPE_UNSUPPORTED');
      if (files.reduce((n, f) => n + f.buffer.length, 0) > BUDGET) return coded(res, 413, 'SUPPORT_ATTACHMENTS_TOO_LARGE');

      const role = getRole();
      const now = Date.now();
      const w = windows.get(role);
      const live = w && now - w.start < RATE_WINDOW_MS ? w : { start: now, count: 0 };
      live.count += 1;
      windows.set(role, live);
      if (live.count > RATE_LIMIT) return coded(res, 429, 'SUPPORT_RATE_LIMITED');

      if (submitMode === 'slow') await delay(2500);
      if (submitMode === 'relay-failed') return coded(res, 502, 'SUPPORT_RELAY_FAILED');
      if (submitMode === 'too-large') return coded(res, 413, 'SUPPORT_ATTACHMENTS_TOO_LARGE');

      seq += 1;
      const code = `INC-${seq}`;
      const timestamp = new Date(now).toISOString();
      log.push({
        code,
        timestamp,
        answeredAs: role,
        category,
        severity,
        path,
        description,
        diagnostics: diagnostics ?? null,
        files: files.map((f, i) => ({ part: f.name, filename: f.filename, bytes: f.buffer.length, sniffed: sniffed[i] })),
      });
      res.status(200).json({ success: true, code, timestamp });
    },
  );

  app.post('/__control/support', (req, res) => {
    const b = req.body ?? {};
    if (b.reset) reset();
    if (b.healthMode !== undefined) healthMode = b.healthMode;
    if (b.quotaMode !== undefined) quotaMode = b.quotaMode;
    if (b.submitMode !== undefined) submitMode = b.submitMode;
    res.json(state());
  });
  app.get('/__control/support/log', (_req, res) => res.json(log));
  app.delete('/__control/support/log', (_req, res) => {
    log = [];
    res.json({ ok: true });
  });

  return { reset };
}
