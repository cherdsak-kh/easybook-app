/**
 * QA stub for login history & session revocation (E1–E6), registered by `stub-server.mjs` on :3301.
 * Paired with `.env.stub`. Feature: `claude_planning/feature/20261004_2055_login_sessions_and_revocation`.
 *
 * ⚠️ IT MIRRORS `@Roles` AND THE DTO SHAPES OF `easybook-service`, because a permissive stub fakes a
 * PASS and an unfaithful shape fakes a FAIL (both have cost cycles here):
 *   - E1–E4 (`/auth/system/sessions*`, `/auth/system/login-history`) answer every role.
 *   - E5 `GET /system-users/:id/sessions` and E6 `POST /system-users/:id/revoke-sessions` answer
 *     SUPER_ADMIN only — ADMIN and VIEWER get the real `RolesGuard` 403 `Insufficient role.`.
 *   - E2, E3 and E6 check `x-csrf-token` (must equal `stub-csrf-token`, else 403 `Invalid CSRF token.`)
 *     BEFORE the role guard, as the real stack does.
 *   - E3: the caller's own current handle → 400, an unknown handle → 404 (one body for both
 *     "already gone" and "somebody else's"); the order of the two literal-vs-parameter DELETEs matters.
 *   - E4: `limit` must be exactly 10, 20 or 50 (else 400 with class-validator's message array, never
 *     clamped); a page past the end answers `data: []` with a correct `meta`.
 *   - E6: self → 400, unknown id → 404, 0 live sessions → 200 `{ revoked: 0 }`.
 *   - `FORCE_REVOKED` history rows carry `device: null` and `ipAddress: null`, as the real ones do.
 *
 * The seeded devices send an `osVersion` on iPadOS ON PURPOSE: the PO/CTO rule is that the UI never
 * prints a version for iOS/iPadOS, and a stub that never sends one cannot prove the UI withholds it.
 *
 * Every E5 request is LOGGED with the role it was answered under, so "an ADMIN/VIEWER fired ZERO E5
 * requests" is read from `GET /__control/sessions/log` rather than assumed (AC-23).
 *
 * Controls (`POST /__control/sessions`, body keys all optional):
 *   sessionsMode  ok | empty | error | slow     (E1: `empty` = no other devices; `error` = 503)
 *   historyMode   ok | empty | error | slow     (E4)
 *   revokeMode    ok | fail | gone              (E2/E3/E6: `fail` = 503 and NOTHING ends; `gone` = E3
 *                                                answers 404 and drops the row, as if ended elsewhere)
 *   staffMode     ok | error                    (E5: `error` = 503)
 *   csrfMode      ok | reject                   (E2/E3/E6 answer 403 `Invalid CSRF token.`)
 *   selfRow       true | false                  (adds / removes a staff row whose id is the signed-in
 *                                                operator's `u1`, so the own-row dialog can be driven)
 *   reset         true                          (back to the seed)
 * `GET /__control/sessions/log` lists the logged E5 requests; `DELETE /__control/sessions/log` clears it.
 */

const FORBIDDEN = { statusCode: 403, message: 'Insufficient role.', error: 'Forbidden' };
const ME_ID = 'u1';
const CURRENT_HANDLE = 'cUrReNtSeSsIoNhAnDlE1';
const MIN = 60_000;

const dev = (deviceType, os, osVersion, browser, browserVersion) => ({
  deviceType,
  os,
  osVersion,
  browser,
  browserVersion,
});
const D_WIN = dev('desktop', 'Windows', null, 'Chrome', '128');
const D_IPAD = dev('tablet', 'iPadOS', '17', 'Safari', '17');
const D_ANDROID = dev('phone', 'Android', '14', 'Chrome', '128');
const D_LINUX = dev('desktop', 'Linux', null, 'Firefox', '129');
const D_IPHONE_LINE = dev('phone', 'iOS', '26', 'LINE', '14');
const D_MAC = dev('desktop', 'macOS', null, 'Safari', '17');

const ago = (minutes) => new Date(Date.now() - minutes * MIN).toISOString();

const othersSeed = () => [
  { handle: 'iPaDsAfArIhAnDlE000001', isCurrent: false, device: D_IPAD, ipAddress: '10.0.4.22', loginAt: ago(26 * 60), lastActiveAt: ago(14 * 60) },
  { handle: 'aNdRoIdChRoMeHaNdLe002', isCurrent: false, device: D_ANDROID, ipAddress: '171.99.38.117', loginAt: ago(9 * 60), lastActiveAt: ago(40) },
  // A session that predates the feature: no address, an unparseable device.
  { handle: 'lEgAcYsEsSiOnHaNdLe003', isCurrent: false, device: dev('unknown', null, null, null, null), ipAddress: null, loginAt: ago(5 * 60), lastActiveAt: ago(3 * 60) },
];

const currentSeed = () => ({
  handle: CURRENT_HANDLE,
  isCurrent: true,
  device: D_WIN,
  ipAddress: '192.168.1.45',
  loginAt: ago(3 * 60),
  lastActiveAt: new Date().toISOString(),
});

/** 34 attempts, newest first: 4 pages at 10, so the pager has something to do. */
function historySeed() {
  const rows = [];
  const devices = [D_WIN, D_ANDROID, D_IPAD, D_LINUX, D_IPHONE_LINE, D_MAC];
  for (let i = 0; i < 34; i++) {
    const bad = i % 7 === 4;
    const forced = i === 9;
    rows.push({
      id: `h${i}`,
      status: forced ? 'FORCE_REVOKED' : bad ? 'FAILED_BAD_PASSWORD' : 'SUCCESS',
      createdAt: ago(3 * 60 + i * 11 * 60),
      device: forced ? null : devices[i % devices.length],
      ipAddress: forced ? null : `203.0.113.${(i * 13) % 250}`,
      isCurrentSession: i === 0,
    });
  }
  return rows;
}

export function registerLoginSessions(app, { getRole, csrfToken, systemUsers }) {
  let current = currentSeed();
  let others = othersSeed();
  let history = historySeed();
  let sessionsMode = 'ok';
  let historyMode = 'ok';
  let revokeMode = 'ok';
  let staffMode = 'ok';
  let csrfMode = 'ok';
  /** user id → ISO of a force sign-out, and the set of users whose sessions it ended. */
  let forcedAt = new Map();
  let ended = new Set();
  let log = [];

  const slow = (mode) => (mode === 'slow' ? new Promise((r) => setTimeout(r, 1500)) : Promise.resolve());
  const unavailable = (res) =>
    res.status(503).json({ statusCode: 503, message: 'Session store unavailable.', error: 'Service Unavailable' });

  const csrf = (req, res, next) => {
    if (csrfMode === 'reject' || req.get('x-csrf-token') !== csrfToken) {
      return res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token.', error: 'Forbidden' });
    }
    next();
  };
  const superAdminOnly = (_req, res, next) => {
    if (getRole() !== 'SUPER_ADMIN') return res.status(403).json(FORBIDDEN);
    next();
  };

  /* ── E1 ── */
  app.get('/api/v1/auth/system/sessions', async (_req, res) => {
    await slow(sessionsMode);
    if (sessionsMode === 'error') return unavailable(res);
    res.json({ current, others: sessionsMode === 'empty' ? [] : others });
  });

  /* ── E2 — declared BEFORE E3, so `others` is never read as a handle ── */
  app.delete('/api/v1/auth/system/sessions/others', csrf, (_req, res) => {
    if (revokeMode === 'fail') return unavailable(res);
    const revoked = others.length;
    others = [];
    res.json({ revoked });
  });

  /* ── E3 ── */
  app.delete('/api/v1/auth/system/sessions/:handle', csrf, (req, res) => {
    const { handle } = req.params;
    if (handle === current.handle) {
      return res.status(400).json({
        statusCode: 400,
        message: 'The current session cannot be revoked here. Use logout instead.',
        error: 'Bad Request',
      });
    }
    const hit = others.find((s) => s.handle === handle);
    if (revokeMode === 'fail') return unavailable(res);
    if (!hit || revokeMode === 'gone') {
      others = others.filter((s) => s.handle !== handle);
      return res.status(404).json({ statusCode: 404, message: 'Session not found.', error: 'Not Found' });
    }
    others = others.filter((s) => s.handle !== handle);
    res.json({ revoked: 1 });
  });

  /* ── E4 ── */
  app.get('/api/v1/auth/system/login-history', async (req, res) => {
    await slow(historyMode);
    const errors = [];
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isInteger(page)) errors.push('page must be an integer number');
    else if (page < 1) errors.push('page must not be less than 1');
    if (![10, 20, 50].includes(limit)) errors.push('limit must be one of the following values: 10, 20, 50');
    if (errors.length) return res.status(400).json({ statusCode: 400, message: errors, error: 'Bad Request' });
    if (historyMode === 'error') return unavailable(res);
    const rows = historyMode === 'empty' ? [] : history;
    res.json({
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: rows.length === 0 ? 0 : Math.ceil(rows.length / limit) },
    });
  });

  /* ── E5 / E6 ── */
  const targetOf = (id) => systemUsers.find((u) => u.id === id);
  const notFound = (res) =>
    res.status(404).json({ statusCode: 404, message: 'System user not found.', error: 'Not Found' });

  /** Live sessions the stub says `u` holds. Your own row agrees with the page it links to. */
  const liveCount = (u) => {
    if (!u.isActive || !u.lastLoginAt || ended.has(u.id)) return 0;
    if (u.id === ME_ID) return 1 + others.length;
    return (parseInt(u.id.replace(/\D/g, ''), 10) || 0) % 3 === 0 ? 2 : 1;
  };

  // Logged BEFORE the role guard, so a denied role's request still shows up (as a 403) and "fired zero
  // requests" can be told apart from "fired and was refused".
  const logE5 = (req, _res, next) => {
    log.push({ role: getRole(), id: req.params.id, at: new Date().toISOString() });
    next();
  };

  app.get('/api/v1/system-users/:id/sessions', logE5, superAdminOnly, async (req, res) => {
    if (staffMode === 'error') return unavailable(res);
    const u = targetOf(req.params.id);
    if (!u) return notFound(res);
    const k = parseInt(u.id.replace(/\D/g, ''), 10) || 0;
    res.json({
      activeSessionCount: liveCount(u),
      // Every fifth account's only login has aged out of the 90-day history: time, no device, no address.
      lastLogin: u.lastLoginAt
        ? {
            at: u.lastLoginAt,
            device: k % 5 === 0 ? null : [D_WIN, D_MAC, D_ANDROID, D_LINUX][k % 4],
            ipAddress: k % 5 === 0 ? null : `10.0.${(k % 9) + 1}.${20 + ((k * 7) % 200)}`,
          }
        : null,
      lastForceRevokedAt: forcedAt.get(u.id) ?? null,
    });
  });

  app.post('/api/v1/system-users/:id/revoke-sessions', csrf, superAdminOnly, (req, res) => {
    if (req.params.id === ME_ID) {
      return res.status(400).json({
        statusCode: 400,
        message: 'You cannot force sign-out your own account. Use the sessions page to end your other devices.',
        error: 'Bad Request',
      });
    }
    const u = targetOf(req.params.id);
    if (!u) return notFound(res);
    if (revokeMode === 'fail') return unavailable(res);
    const revoked = liveCount(u);
    if (revoked > 0) {
      ended.add(u.id);
      forcedAt.set(u.id, new Date().toISOString());
    }
    res.json({ revoked });
  });

  /* ── control plane ── */
  const selfRow = () => ({
    id: ME_ID,
    email: 'qa.stub@example.local',
    firstName: 'ผู้ทดสอบ',
    lastName: 'ระบบ',
    role: getRole(),
    department: { id: 1, name: 'ฝ่ายพัฒนาระบบ' },
    personnelRole: { id: 1, name: 'ผู้พัฒนาระบบ' },
    mustChangePassword: false,
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lineUserId: null,
    lastLoginAt: '2026-09-06T01:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
  });
  const state = () => ({
    sessionsMode,
    historyMode,
    revokeMode,
    staffMode,
    csrfMode,
    selfRow: systemUsers.some((u) => u.id === ME_ID),
    others: others.length,
    forcedUsers: [...forcedAt.keys()],
  });
  const reset = () => {
    current = currentSeed();
    others = othersSeed();
    history = historySeed();
    sessionsMode = historyMode = revokeMode = staffMode = csrfMode = 'ok';
    forcedAt = new Map();
    ended = new Set();
    log = [];
    const i = systemUsers.findIndex((u) => u.id === ME_ID);
    if (i >= 0) systemUsers.splice(i, 1);
  };

  app.post('/__control/sessions', (req, res) => {
    const b = req.body ?? {};
    if (b.reset) reset();
    if (b.sessionsMode !== undefined) sessionsMode = b.sessionsMode;
    if (b.historyMode !== undefined) historyMode = b.historyMode;
    if (b.revokeMode !== undefined) revokeMode = b.revokeMode;
    if (b.staffMode !== undefined) staffMode = b.staffMode;
    if (b.csrfMode !== undefined) csrfMode = b.csrfMode;
    if (b.selfRow === true && !systemUsers.some((u) => u.id === ME_ID)) systemUsers.unshift(selfRow());
    if (b.selfRow === false) {
      const i = systemUsers.findIndex((u) => u.id === ME_ID);
      if (i >= 0) systemUsers.splice(i, 1);
    }
    res.json(state());
  });
  app.get('/__control/sessions/log', (_req, res) => res.json(log));
  app.delete('/__control/sessions/log', (_req, res) => {
    log = [];
    res.json({ ok: true });
  });

  return { reset };
}
