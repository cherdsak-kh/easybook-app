/**
 * QA stub backend for the admin portal, on :3301. Paired with `easybook-app`'s `.env.stub`.
 *
 * ⚠️ IT MIRRORS `@Roles` DELIBERATELY. A permissive stub turns a browser ACL check into a false
 * pass — that is exactly how a VIEWER 403 was missed once in this project. Write routes here
 * refuse VIEWER with a real 403, and the `/admin` socket namespace refuses VIEWER at the
 * handshake, because the real gateway does.
 *
 * ⚠️ IT MUST ALSO BE CONTRACT-FAITHFUL, not just permission-faithful. `easybook-service`'s DTOs
 * under `src/.../dto/` (any feature module) are the ONLY source of shape here — never the frontend's local interfaces,
 * never a guess from a property name. An unfaithful stub is the mirror-image bug to a permissive
 * one: it does not produce a false PASS, it produces a false FAIL — a screen that is actually fine
 * gets reported as broken because the fake data does not match what the real service would send
 * (GAP-2, `line-users.registration` shipped as `{id,name}` objects instead of resolved strings).
 *
 * Served (mirrors the real `@Roles` on each):
 *   - auth/system/{csrf,me,logout}          — always answers; no VIEWER distinction
 *   - GET  venues                           — SUPER_ADMIN|ADMIN|VIEWER
 *   - GET  departments / personnel-roles    — SUPER_ADMIN|ADMIN only (VIEWER 403, real contract)
 *   - GET  venue-types / amenities          — SUPER_ADMIN|ADMIN only (VIEWER 403, real contract)
 *   - GET  line-users                       — SUPER_ADMIN|ADMIN|VIEWER
 *   - GET  system-users, system-users/:id   — SUPER_ADMIN|ADMIN|VIEWER
 *   - GET  system/version                   — every role (no `@Roles`, session only)
 *                                             DEFAULT AGREES WITH `package.json`; drive the
 *                                             disagreement state via `POST /__control/version`
 *   - booking-requests (list/detail/approve/reject/cancel/preflight/direct) — as before
 *   - GET  announcements                    — SUPER_ADMIN|ADMIN|VIEWER. Validates the query like
 *                                             `ListAnnouncementsQueryDto` + the global pipe (400 on
 *                                             an unknown key, `limit` ∉ {10,20,50}, `page` < 1, an
 *                                             unknown/uppercase `status`, `q` > 100). Driven by
 *                                             `listMode` — see `POST /__control/announcements`
 *   - GET  announcements/line-bot-info      — SUPER_ADMIN|ADMIN|VIEWER. Every answer the real route
 *                                             gives, driven by `botMode` (ok, bot mode, the two coded
 *                                             503s, the code-less session-store 503, a dead socket)
 *   - GET  announcements/:id                — SUPER_ADMIN|ADMIN|VIEWER. 404 `Announcement not found.`
 *                                             Declared AFTER `line-bot-info`, as in the real controller
 *   - POST announcements, PATCH/DELETE announcements/:id, POST announcements/:id/send
 *                                           — SUPER_ADMIN|ADMIN only (VIEWER 403). ⚠️ THESE FIVE and
 *                                             the three canned-reply writes (and only these — the
 *                                             booking writes never did) CHECK CSRF: `x-csrf-token`
 *                                             must equal `stub-csrf-token`, else 403 `Invalid CSRF
 *                                             token.` (CSRF runs before the role guard, as in the real
 *                                             stack). POST/PATCH validate like the phase-1 DTOs under
 *                                             the global pipe; send follows the phase-2 order. DELETE
 *                                             is a SOFT delete of a DRAFT or a SENT row (ANNOUNCE-API-5)
 *                                             with a coded 404/409. Driven by `sendMode` / `saveMode` /
 *                                             `deleteMode` / `csrfMode` / `sendDelayMs` / `mutate`
 *   - GET  canned-replies                   — SUPER_ADMIN|ADMIN|VIEWER. A PLAIN array in the server's
 *                                             order (`sortOrder`, `createdAt`, `id`). Seeded with the
 *                                             migration's four defaults, byte for byte
 *   - POST canned-replies, PATCH/DELETE canned-replies/:id
 *                                           — SUPER_ADMIN|ADMIN only (VIEWER 403), CSRF-checked.
 *                                             Validate like `Create/UpdateCannedReplyDto`; coded 400
 *                                             `CANNED_REPLIES_LIMIT_EXCEEDED` / `CANNED_REPLY_UPDATE_
 *                                             EMPTY`, coded 404 `CANNED_REPLY_NOT_FOUND`. Driven by
 *                                             `POST /__control/canned-replies` — see below
 *
 *   - GET system/integrations; PATCH …/swagger, …/line; POST …/line/verify, …/storage/probe
 *                                           — INTEGRATIONS-API-1. GET + POSTs SUPER_ADMIN|ADMIN, the
 *                                             two PATCHes SUPER_ADMIN only; VIEWER 403 on all. CSRF-
 *                                             checked before the role guard. Driven by
 *                                             `POST /__control/integrations` { lineMode, storageMode,
 *                                             dbMode, redisMode, swagger, configured }
 *
 * What this stub does NOT serve (a 404 here is expected, not a bug):
 *   - Any WRITE on line-users (`PATCH /line-users/:id`, `PATCH /line-users/:id/registration`)
 *   - Any CRUD on personnel-roles / departments / venue-types / amenities (POST/PATCH/DELETE)
 *   - Any CRUD on venues beyond the list (POST/PATCH/DELETE, close/reopen, photo upload)
 *   - system-users writes (create/update/delete/restore/reset-password)
 *   - auth/system/password, avatar upload, LINE registration/webhook routes
 * A screen that calls one of the above against this stub will see a 404, not a 403 or a shape bug
 * — that is a genuinely unimplemented corner of the stub, not a contract mismatch.
 *
 * Control plane (not part of the real contract, prefixed `__`):
 *   POST /__control/role      { role }                       — switch the signed-in role
 *   POST /__control/emit      { event, id, status, actor }   — push a realtime event
 *   POST /__control/version   { version, build?, releasedAt? } — set what GET system/version reports
 *   POST /__control/announcements { botMode?, listMode?, sendMode?, sendDelayMs?, saveMode?,
 *                                   deleteMode?, csrfMode?, mutate? }
 *                                                            — force the bot-info card, the list,
 *                                                              the write outcomes; `mutate` acts as
 *                                                              another admin would, once
 *   POST /__control/canned-replies { listMode?, createMode?, saveMode?, csrfMode?, delayMs?,
 *                                    mutate?, fill? }        — force the canned-reply card's load,
 *                                                              the write outcomes, the limit
 *   POST /__control/reset                                     — restore the seeds, the version and
 *                                                              every announcement and canned mode
 *
 * ── How to run this (the full recipe) ─────────────────────────────────────
 *
 * Terminal 1 (this stub, serves :3301):
 *   npm run stub
 *
 * Terminal 2 (the app, pointed at the stub via .env.stub, serves :2201):
 *   npm run dev -- --mode stub --port 2201
 *
 * Then open http://localhost:2201 and drive the admin portal against fake data.
 *
 * Worked `curl` examples for the four control routes:
 *
 *   # Switch the signed-in role (try VIEWER to hit the 403/handshake-refusal paths)
 *   curl -s -X POST http://localhost:3301/__control/role \
 *     -H "Content-Type: application/json" \
 *     -d '{"role":"VIEWER"}'
 *
 *   # Push a realtime event over the /admin socket namespace
 *   curl -s -X POST http://localhost:3301/__control/emit \
 *     -H "Content-Type: application/json" \
 *     -d '{"event":"bookingRequest.updated","id":"b1","status":"APPROVED"}'
 *
 *   # Downgrade the server behind the app, then reload /backend/help/version:
 *   # the status line turns amber and names BOTH numbers. `build`/`releasedAt` are
 *   # optional and keep their current values when omitted.
 *   curl -s -X POST http://localhost:3301/__control/version \
 *     -H "Content-Type: application/json" \
 *     -d '{"version":"0.4.0"}'
 *   # → {"version":"0.4.0","build":"stub0000","releasedAt":"2026-09-06T12:00:00.000Z"}
 *
 *   # …and the reset that undoes it — back to agreeing with `package.json`
 *   curl -s -X POST http://localhost:3301/__control/reset \
 *     -H "Content-Type: application/json" -d '{}'
 *   # → {"ok":true,"rows":96,"version":"0.13.0",…,"deleteMode":"ok","cannedReplies":4}
 *
 *   # A bad body is REFUSED rather than half-applied, so `/api/v1/system/version` can never
 *   # serve `{"version":undefined}` and turn a stub typo into a phantom frontend bug.
 *   curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3301/__control/version \
 *     -H "Content-Type: application/json" -d '{}'
 *   # → 400
 *
 *   # ประกาศและข่าวสาร — force the LINE OA card into one state, then reload (or press ลองอีกครั้ง).
 *   # botMode: ok | ok-picture | bot | not-configured | unavailable | no-code | network
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"botMode":"not-configured"}'
 *   # → {"botMode":"not-configured","listMode":"ok","sendMode":"ok","sendDelayMs":0,
 *   #    "saveMode":"ok","deleteMode":"ok","csrfMode":"ok"}
 *
 *   # …and the list. listMode: ok | empty (every query 0 rows, pills 0/0/0) | fail (code-less 503)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"listMode":"fail"}'
 *
 *   # ── Phase 4: the writes. Every switch is STICKY until changed or `/__control/reset`. ──
 *   # sendMode — what `POST /announcements/:id/send` answers once the row passes the 404 / already-
 *   # sent / body / department checks:
 *   #   ok (SENT; sentCount 1248 for ALL, 42 for a department) ·
 *   #   zero-recipients (200, SENT, sentAt now, sentCount 0 — ANNOUNCE-API-5: nobody eligible is
 *   #     not an error any more; the old `no-recipients` value is GONE and is refused with a 400) ·
 *   #   partial (commits SENT with 500, then 502 with acceptedCount 500 / targetedCount 734) ·
 *   #   line-failed (502, row untouched) · not-configured (503) · rate-limited (503) ·
 *   #   no-code (code-less 503, the session store — answered BEFORE any row check) ·
 *   #   in-progress (409) · already-sent (commits SENT FIRST, as another admin would, then 409) ·
 *   #   network (drops the socket, the row stays DRAFT) ·
 *   #   network-after-commit (commits SENT, then drops the socket)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"sendMode":"line-failed"}'
 *
 *   # sendDelayMs — an integer 0–10000, slept before the send answers (watch the double-submit lock)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"sendDelayMs":5000}'
 *
 *   # saveMode — POST, PATCH and DELETE: ok · no-code (code-less 503) · network (drops the socket;
 *   # nothing is written)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"saveMode":"no-code"}'
 *
 *   # csrfMode — ok · reject (EVERY announcement write answers 403 `Invalid CSRF token.`, so the
 *   # app's one retry shows as two requests before the 403 copy)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"csrfMode":"reject"}'
 *
 *   # deleteMode — `DELETE /announcements/:id` once the row exists: ok (soft delete, 204, DRAFT or
 *   # SENT) · in-progress (coded 409 ANNOUNCEMENT_SEND_IN_PROGRESS, nothing deleted). A missing row
 *   # is a coded 404 ANNOUNCEMENT_NOT_FOUND FIRST, whatever the mode — the real lock only sees live rows.
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" -d '{"deleteMode":"in-progress"}'
 *
 *   # mutate — act as ANOTHER admin, once, right now (not stored as a mode). The id must exist.
 *   #   delete (row gone → 404 paths; a DRAFT or a SENT row) ·
 *   #   markSent (row SENT → 409 paths; DRAFT only) ·
 *   #   clearBody (body '' → the server's ANNOUNCEMENT_BODY_REQUIRED behind an unchanged dialog;
 *   #   DRAFT only)
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" \
 *     -d '{"mutate":{"id":"cmfann015x7k2q9w4e1r5t8y0","action":"markSent"}}'
 *   # …another admin deletes the SENT seed row 001 while you have it open in `view`:
 *   curl -s -X POST http://localhost:3301/__control/announcements \
 *     -H "Content-Type: application/json" \
 *     -d '{"mutate":{"id":"cmfann001x7k2q9w4e1r5t8y0","action":"delete"}}'
 *
 *   # Any unknown key or bad value is a 400 and changes NOTHING (all-or-nothing). The answer echoes
 *   # every mode, plus `mutated: <id>` when `mutate` was given.
 *
 *   # ── ข้อความตอบกลับด่วน (ANNOUNCE-UI-6). Every switch is STICKY until changed or reset. ──
 *   # listMode — every GET: ok · error (code-less 503, the session store) · network (drops the socket)
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"listMode":"error"}'
 *
 *   # createMode — POST: ok · limit (coded 400 CANNED_REPLIES_LIMIT_EXCEEDED even below 5 rows —
 *   # the "UI shows 4/5, somebody else added the 5th" race)
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"createMode":"limit"}'
 *
 *   # saveMode — POST, PATCH and DELETE: ok · no-code (code-less 503) · network (drops the socket;
 *   # nothing is written)
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"saveMode":"no-code"}'
 *
 *   # csrfMode — ok · reject (every canned write answers 403 `Invalid CSRF token.`; the app's one
 *   # retry shows as two requests). INDEPENDENT of the announcements' `csrfMode`.
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"csrfMode":"reject"}'
 *
 *   # delayMs — an integer 0–10000, slept before EVERY canned route answers, GET included (the
 *   # skeleton, the busy state; a `csrfMode: reject` write takes 2 × delay)
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"delayMs":5000}'
 *
 *   # mutate — ANOTHER admin deletes a reply, once, now → 404 on your next PATCH/DELETE of it
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" \
 *     -d '{"mutate":{"id":"canned_reply_default_2","action":"delete"}}'
 *
 *   # fill — append test rows until there are 5 (the limit in one call). Only `true` is accepted.
 *   curl -s -X POST http://localhost:3301/__control/canned-replies \
 *     -H "Content-Type: application/json" -d '{"fill":true}'
 *
 *   # All-or-nothing like the others. The answer echoes every mode plus `count`, and `mutated` /
 *   # `filled` (rows appended) when those were given.
 */
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const PORT = 3301;
const ORIGIN = ['http://localhost:2201', 'http://localhost:2200'];

const app = express();
app.use(express.json());
app.use(cors({ origin: ORIGIN, credentials: true }));

/* ── vocabularies (option tables) ─────────────────────────────────────────
 * Shapes mirror `DepartmentResponseDto` / `PersonnelRoleResponseDto` (holderCount = staffCount +
 * registrationCount, two populations) and `VenueTypeResponseDto` / `AmenityResponseDto` (one
 * population, `holderCount` only). `isFallback` is false on every PLAIN row. Departments alone also
 * model the two reserved rows the real server shows ONLY to SUPER_ADMIN — the System-Developer row
 * and the `ไม่พบกลุ่ม/ฝ่าย` tombstone — in `RESERVED_DEPARTMENTS` below (announcements phase 4 A-17).
 * `findDept` and every other seed stay on the plain rows.
 */

const OPTION_STAMP = { createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' };

const DEPARTMENTS = [
  { id: 1, name: 'ฝ่ายกิจการนักเรียน', isSystemReserved: false, staffCount: 4, registrationCount: 9 },
  { id: 2, name: 'กลุ่มสาระวิทยาศาสตร์', isSystemReserved: false, staffCount: 7, registrationCount: 6 },
].map((d) => ({ ...d, ...OPTION_STAMP, isFallback: false, holderCount: d.staffCount + d.registrationCount }));

/**
 * ⚠️ SUPER_ADMIN ONLY (`GET /departments`, and the announcement write validation). The tombstone
 * carries BOTH flags, as the real one does — `isSystemReserved` AND `isFallback` — so a client that
 * forgets to drop `isFallback` rows offers `ไม่พบกลุ่ม/ฝ่าย` as a choice and the check catches it.
 */
const RESERVED_DEPARTMENTS = [
  { id: 98, name: 'ไม่พบกลุ่ม/ฝ่าย', isSystemReserved: true, isFallback: true, staffCount: 0, registrationCount: 0 },
  { id: 99, name: 'ฝ่ายพัฒนาระบบ', isSystemReserved: true, isFallback: false, staffCount: 1, registrationCount: 0 },
].map((d) => ({ ...d, ...OPTION_STAMP, holderCount: d.staffCount + d.registrationCount }));

/** What `GET /departments` answers this role — and so what an announcement may target (A-17). */
const activeDeptsFor = (r) => (r === 'SUPER_ADMIN' ? [...DEPARTMENTS, ...RESERVED_DEPARTMENTS] : DEPARTMENTS);

const PERSONNEL_ROLES = [
  { id: 1, name: 'ครู', isSystemReserved: false, staffCount: 5, registrationCount: 10 },
  { id: 2, name: 'เจ้าหน้าที่ธุรการ', isSystemReserved: false, staffCount: 3, registrationCount: 2 },
].map((r) => ({ ...r, ...OPTION_STAMP, isFallback: false, holderCount: r.staffCount + r.registrationCount }));

const VENUE_TYPES = [
  { id: 1, name: 'หอประชุม', holderCount: 2 },
  { id: 2, name: 'ห้องประชุม', holderCount: 1 },
  { id: 3, name: 'โรงยิม', holderCount: 1 },
  { id: 4, name: 'ลานกิจกรรม', holderCount: 1 },
].map((v) => ({ ...v, ...OPTION_STAMP, isSystemReserved: false, isFallback: false }));

const AMENITIES = [
  { id: 1, name: 'เครื่องเสียง', holderCount: 3 },
  { id: 2, name: 'โปรเจกเตอร์', holderCount: 2 },
  { id: 3, name: 'Wi-Fi', holderCount: 4 },
  { id: 4, name: 'เครื่องปรับอากาศ', holderCount: 5 },
].map((a) => ({ ...a, ...OPTION_STAMP, isSystemReserved: false, isFallback: false }));

const findDept = (id) => DEPARTMENTS.find((d) => d.id === id) ?? DEPARTMENTS[0];
const findRole = (id) => PERSONNEL_ROLES.find((r) => r.id === id) ?? PERSONNEL_ROLES[0];
const findVenueType = (id) => VENUE_TYPES.find((v) => v.id === id) ?? VENUE_TYPES[0];
const findAmenities = (ids) =>
  ids.map((id) => AMENITIES.find((a) => a.id === id)).filter(Boolean).map((a) => ({ id: a.id, name: a.name }));

/* ── state ─────────────────────────────────────────────────────────────── */

let role = 'SUPER_ADMIN';

/**
 * What `GET /api/v1/system/version` reports, and it starts out AGREEING with the app.
 *
 * ⚠️ The default is read from `package.json` at startup rather than written here as a literal,
 * because the app's own number comes from the same file (`vite.config.ts` → `__APP_VERSION__`) and
 * a literal only agrees with it until the next bump. This stub previously hard-coded `0.4.0`
 * against a `0.13.0` app, so `/backend/help/version` opened on an amber disagreement banner on a
 * perfectly healthy stub — a warning state as the DEFAULT teaches the next reader to distrust the
 * colour, in a tool whose whole job is to not produce false failures.
 *
 * Resolved from this file's own location, not `process.cwd()`, so the stub is correct no matter
 * where it is started from. A missing/unreadable `package.json` throws here, at startup, loudly —
 * far better than silently serving a stale number nobody would think to question.
 *
 * The disagreement branch is still one curl away — see `POST /__control/version` below. It drives
 * the versions apart in EITHER direction, which matches how the page reads them: the status line
 * keys off disagreement, not off the app being ahead.
 */
const APP_PACKAGE_VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
).version;

const DEFAULT_SYSTEM_VERSION = {
  version: APP_PACKAGE_VERSION,
  build: 'stub0000',
  releasedAt: '2026-09-06T12:00:00.000Z',
};

let systemVersion = { ...DEFAULT_SYSTEM_VERSION };

const VENUES = [
  {
    id: 'v1',
    name: 'หอประชุมวารณ',
    venueTypeId: 1,
    capacity: 800,
    location: 'อาคารอำนวยการ',
    description: 'หอประชุมใหญ่ของโรงเรียน มีเวทีถาวรและระบบไฟเวที',
    isOpen: true,
    amenityIds: [1, 3, 4],
  },
  {
    id: 'v2',
    name: 'ห้องประชุมไอยราพรต',
    venueTypeId: 2,
    capacity: 60,
    location: 'ชั้น 3 อาคาร 2',
    description: null,
    isOpen: true,
    amenityIds: [2, 3],
  },
  {
    id: 'v3',
    name: 'ลานกิจกรรม (ข้างพระนเรศวร)',
    venueTypeId: 4,
    capacity: 500,
    location: null,
    description: null,
    isOpen: true,
    amenityIds: [3],
  },
  {
    id: 'v4',
    name: 'โรงยิม 1',
    venueTypeId: 3,
    capacity: 250,
    location: 'อาคารพลศึกษา',
    description: null,
    isOpen: false,
    amenityIds: [4],
  },
  {
    id: 'v5',
    name: 'โดมเขียว (สนามฟุตซอล)',
    venueTypeId: 1,
    capacity: 300,
    location: null,
    description: null,
    isOpen: true,
    amenityIds: [],
  },
];

const venueDto = (v) => ({
  id: v.id,
  name: v.name,
  venueType: (() => {
    const t = findVenueType(v.venueTypeId);
    return { id: t.id, name: t.name, isFallback: false };
  })(),
  capacity: v.capacity,
  location: v.location,
  description: v.description,
  isOpen: v.isOpen,
  closedReason: v.isOpen ? null : 'ปรับปรุงพื้นสนาม',
  photos: [],
  amenities: findAmenities(v.amenityIds ?? []),
  createdAt: '2026-08-25T02:00:00.000Z',
  updatedAt: '2026-08-25T02:00:00.000Z',
});

const iso = (d, h, m) =>
  new Date(Date.UTC(2026, 8, d, h - 7, m)).toISOString(); // Asia/Bangkok → UTC

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/** 96 rows ⇒ 10 pages at limit 10, so the 7-number window MUST elide with `…`. */
function seed() {
  const rows = [];
  for (let i = 0; i < 96; i++) {
    const v = VENUES[i % VENUES.length];
    const status = i < 23 ? 'PENDING' : STATUSES[i % 4];
    const day = 10 + (i % 18);
    const multi = i % 5 === 0;
    const slots = [
      {
        id: `s${i}a`,
        startAt: iso(day, 9, 0),
        endAt: iso(day, 12, 0),
        isCancelled: false,
        cancelledAt: null,
        cancelReason: null,
        cancelledByRole: null,
      },
    ];
    if (multi) {
      slots.push({
        id: `s${i}b`,
        startAt: iso(day + 1, 13, 0),
        endAt: iso(day + 1, 16, 30),
        isCancelled: i % 10 === 0,
        cancelledAt: i % 10 === 0 ? iso(day, 8, 0) : null,
        cancelReason: i % 10 === 0 ? 'ผู้ขอแจ้งเลื่อนกิจกรรม' : null,
        cancelledByRole: i % 10 === 0 ? 'ADMIN' : null,
      });
    }
    const line = i % 3 !== 0;
    rows.push({
      id: `b${i}`,
      code: `BR-25690${(901 + (i % 9)).toString()}-${String(i + 1).padStart(3, '0')}`,
      status,
      origin: line ? 'LINE' : 'ADMIN',
      isExpired: status === 'PENDING' && i % 17 === 0,
      requester: {
        name: line ? `ครูสมชาย ใจดี ${i + 1}` : `เจ้าหน้าที่ธุรการ ${i + 1}`,
        phone: line ? '081-234-5678' : '02-123-4567 ต่อ 21',
        departmentName: i % 2 ? 'กลุ่มสาระวิทยาศาสตร์' : 'ฝ่ายกิจการนักเรียน',
      },
      venue: { id: v.id, name: v.name, location: v.location },
      purpose:
        i % 4 === 0
          ? 'ประชุมผู้ปกครองประจำภาคเรียนที่ 2 ปีการศึกษา 2569'
          : 'ซ้อมการแสดงสำหรับงานกีฬาสีประจำปี',
      attendees: 20 + ((i * 17) % 400),
      firstStartAt: slots[0].startAt,
      lastEndAt: slots[slots.length - 1].endAt,
      slots,
      rejectReason: status === 'REJECTED' ? 'ทับซ้อนกับคำขอที่ได้รับอนุมัติ' : null,
      createdAt: iso(1 + (i % 5), 8 + (i % 9), (i * 7) % 60),
    });
  }
  return rows;
}

let ROWS = seed();

/* ── guards, mirroring the real stack ──────────────────────────────────── */

const requireWrite = (req, res, next) => {
  if (role === 'VIEWER') {
    return res
      .status(403)
      .json({ statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' });
  }
  next();
};

/**
 * Mirrors `@Roles(SUPER_ADMIN, ADMIN)` on a GET — used by the four curated-option tables
 * (departments, personnel-roles, venue-types, amenities), which deny VIEWER on the READ too,
 * unlike `line-users` / `system-users` / `venues`, which admit VIEWER on GET. Same 403 body as
 * `requireWrite` — the real `RolesGuard` answers the identical shape either way.
 */
const denyViewerRead = (req, res, next) => {
  if (role === 'VIEWER') {
    return res
      .status(403)
      .json({ statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' });
  }
  next();
};

/* ── auth ──────────────────────────────────────────────────────────────── */

/** The token `GET /csrf` hands out, and the one the five announcement and three canned writes check. */
const CSRF_TOKEN = 'stub-csrf-token';

app.get('/api/v1/auth/system/csrf', (_req, res) => res.json({ csrfToken: CSRF_TOKEN }));

app.get('/api/v1/auth/system/me', (_req, res) =>
  res.json({
    id: 'u1',
    email: 'qa.stub@example.local',
    firstName: 'ผู้ทดสอบ',
    lastName: 'ระบบ',
    role,
    department: { id: 1, name: 'ฝ่ายพัฒนาระบบ' },
    personnelRole: { id: 1, name: 'ผู้พัฒนาระบบ' },
    mustChangePassword: false,
    phoneNumber: null,
    profilePictureUrl: null,
    isActive: true,
    lastLoginAt: '2026-09-06T01:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
  }),
);

app.post('/api/v1/auth/system/logout', (_req, res) => res.status(204).end());

/* ── vocabularies (endpoints) ──────────────────────────────────────────── */

app.get('/api/v1/venues', (_req, res) => res.json(VENUES.map(venueDto)));

// SUPER_ADMIN also gets the reserved row and the tombstone; ADMIN only the plain rows (A-17).
app.get('/api/v1/departments', denyViewerRead, (_req, res) => res.json(activeDeptsFor(role)));
app.get('/api/v1/personnel-roles', denyViewerRead, (_req, res) => res.json(PERSONNEL_ROLES));
app.get('/api/v1/venue-types', denyViewerRead, (_req, res) => res.json(VENUE_TYPES));
app.get('/api/v1/amenities', denyViewerRead, (_req, res) => res.json(AMENITIES));

// Mirrors `SystemVersionResponseDto`. The value is state, not a literal — see `systemVersion`.
app.get('/api/v1/system/version', (_req, res) => res.json(systemVersion));

/**
 * Seed for `GET /line-users`. Fields mirror `LineUserResponseDto` + the nested
 * `LineUserRegistrationSummaryDto` exactly: `registration.department` / `.personnelRole` are the
 * RESOLVED NAME STRINGS (never `{id,name}` objects — that shape crashed `LineUsersPage.tsx`,
 * which renders them directly inside a `<span>`), `departmentId` / `personnelRoleId` are the raw
 * FK ids, and top-level `registeredAt` is the registration submission date (NOT `followedAt`).
 *
 * `access: 'UNREGISTERED'` with `registration: null` is kept reachable (i === 4, i === 9, …) — a
 * LINE follower who never submitted the form is a real, distinct state the screen renders.
 */
const LINE_USER_ACCESS_CYCLE = ['ALLOWED', 'PENDING', 'BLOCKED', 'REJECTED', 'UNREGISTERED'];

function lineUserSeed(count) {
  return Array.from({ length: count }, (_, i) => {
    const access = LINE_USER_ACCESS_CYCLE[i % LINE_USER_ACCESS_CYCLE.length];
    const dept = findDept(DEPARTMENTS[i % DEPARTMENTS.length].id);
    const pRole = findRole(PERSONNEL_ROLES[i % PERSONNEL_ROLES.length].id);
    const base = {
      id: `lu${i}`,
      lineUserId: `U${'0'.repeat(30)}${i}`,
      displayName: `ครูสมชาย ใจดี ${i + 1}`,
      pictureUrl: null,
      statusMessage: null,
      richMenuType: access === 'ALLOWED' ? 'TYPE_2' : 'TYPE_1',
      access,
      followedAt: iso(1 + (i % 20), 8, 0),
    };
    if (access === 'UNREGISTERED') {
      return {
        ...base,
        registeredAt: null,
        rejectionReason: null,
        blockReason: null,
        registration: null,
      };
    }
    return {
      ...base,
      registeredAt: iso(2 + (i % 20), 9, 30),
      rejectionReason: access === 'REJECTED' ? 'เบอร์โทรศัพท์ไม่ตรงกับที่แจ้งไว้' : null,
      blockReason: access === 'BLOCKED' ? 'ใช้บัญชีผิดคน รอยืนยันตัวตนอีกครั้ง' : null,
      registration: {
        firstName: 'สมชาย',
        lastName: `ใจดี ${i + 1}`,
        phone: '081-234-5678',
        departmentId: dept.id,
        department: dept.name,
        personnelRoleId: pRole.id,
        personnelRole: pRole.name,
      },
    };
  });
}

app.get('/api/v1/line-users', (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const page = Number(req.query.page ?? 1);
  const all = lineUserSeed(12);
  let out = all;
  if (req.query.access) out = out.filter((r) => r.access === req.query.access);
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    out = out.filter(
      (r) =>
        (r.displayName ?? '').toLowerCase().includes(q) ||
        (r.registration?.firstName ?? '').toLowerCase().includes(q) ||
        (r.registration?.lastName ?? '').toLowerCase().includes(q),
    );
  }
  const total = out.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(page, totalPages);
  res.json({
    data: out.slice((p - 1) * limit, p * limit),
    meta: { page: p, limit, total, totalPages },
  });
});

/* ── system-users (staff) ──────────────────────────────────────────────── */

/**
 * Shape mirrors `SystemUserResponseDto`: `department` / `personnelRole` are nested `{id,name}`
 * (`SystemUserOptionDto`), `createdBy` is `{id,firstName,lastName}` or `null`
 * (`SystemUserCreatorDto`) — never an email or a role. GET is `SUPER_ADMIN|ADMIN|VIEWER`
 * (real contract); writes are not served by this stub (see the header's "NOT served" list).
 */
const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

function systemUserSeed(count) {
  return Array.from({ length: count }, (_, i) => {
    const dept = findDept(DEPARTMENTS[i % DEPARTMENTS.length].id);
    const pRole = findRole(PERSONNEL_ROLES[i % PERSONNEL_ROLES.length].id);
    return {
      id: `su${i}`,
      email: `staff${i + 1}@easybook.local`,
      firstName: `เจ้าหน้าที่`,
      lastName: `คนที่ ${i + 1}`,
      role: SYSTEM_ROLES[i % SYSTEM_ROLES.length],
      department: { id: dept.id, name: dept.name },
      personnelRole: { id: pRole.id, name: pRole.name },
      mustChangePassword: i % 7 === 0,
      phoneNumber: i % 2 === 0 ? '02-123-4567 ext. 101' : null,
      profilePictureUrl: null,
      isActive: i % 11 !== 0,
      lineUserId: null,
      lastLoginAt: i === 0 ? null : iso(3 + (i % 15), 9, 0),
      createdAt: iso(1 + (i % 10), 8, 0),
      createdBy: i === 0 ? null : { id: 'su0', firstName: 'ผู้ทดสอบ', lastName: 'ระบบ' },
      updatedAt: iso(1 + (i % 10), 8, 0),
    };
  });
}

const SYSTEM_USERS = systemUserSeed(14);

app.get('/api/v1/system-users', (req, res) => {
  const limit = Number(req.query.limit ?? 20);
  const page = Number(req.query.page ?? 1);
  let out = SYSTEM_USERS;
  if (req.query.role) out = out.filter((u) => u.role === req.query.role);
  if (req.query.status) {
    const wantsDeleted = req.query.status === 'deleted';
    if (wantsDeleted) {
      out = []; // no soft-deleted rows modeled in this stub
    } else if (req.query.status === 'suspended') {
      out = out.filter((u) => !u.isActive);
    } else if (req.query.status === 'pending') {
      out = out.filter((u) => u.isActive && u.mustChangePassword);
    } else if (req.query.status === 'active') {
      out = out.filter((u) => u.isActive && !u.mustChangePassword);
    }
  }
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    out = out.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }
  const total = out.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(page, totalPages);
  res.json({
    data: out.slice((p - 1) * limit, p * limit),
    meta: { page: p, limit, total, totalPages },
  });
});

app.get('/api/v1/system-users/:id', (req, res) => {
  const u = SYSTEM_USERS.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ statusCode: 404, message: 'System user not found.' });
  res.json(u);
});

/* ── booking requests ──────────────────────────────────────────────────── */

const minStart = (r) =>
  Math.min(...r.slots.filter((s) => !s.isCancelled).map((s) => +new Date(s.startAt)));

app.get('/api/v1/booking-requests', (req, res) => {
  const { status, venueId, search, sort = 'created-desc' } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);

  let out = ROWS.slice();
  if (venueId) out = out.filter((r) => r.venue.id === venueId);
  if (search) {
    const q = String(search).toLowerCase();
    out = out.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.venue.name.toLowerCase().includes(q) ||
        (r.requester.name ?? '').toLowerCase().includes(q),
    );
  }
  // counts IGNORE the status filter — the real service computes them over the same
  // search/venue scope so the badges do not move as tabs are switched.
  const counts = {
    all: out.length,
    pending: out.filter((r) => r.status === 'PENDING').length,
    approved: out.filter((r) => r.status === 'APPROVED').length,
    rejected: out.filter((r) => r.status === 'REJECTED').length,
    cancelled: out.filter((r) => r.status === 'CANCELLED').length,
  };
  if (status) out = out.filter((r) => r.status === status);

  const dir = sort.endsWith('-asc') ? 1 : -1;
  const key = sort.startsWith('event') ? minStart : (r) => +new Date(r.createdAt);
  out.sort((a, b) => (key(a) - key(b)) * dir);

  const total = out.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(page, totalPages);
  res.json({
    data: out.slice((p - 1) * limit, p * limit),
    meta: { page: p, limit, total, totalPages },
    counts,
  });
});

app.get('/api/v1/booking-requests/:id', (req, res) => {
  const row = ROWS.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ statusCode: 404, message: 'Booking not found.' });
  const losers =
    row.status === 'PENDING'
      ? ROWS.filter(
          (o) => o.id !== row.id && o.status === 'PENDING' && o.venue.id === row.venue.id,
        )
          .slice(0, 2)
          .map((o) => ({
            id: o.id,
            code: o.code,
            requesterName: o.requester.name,
            firstStartAt: o.firstStartAt,
            lastEndAt: o.lastEndAt,
          }))
      : [];
  res.json({
    ...row,
    venue: { ...row.venue, capacity: VENUES.find((v) => v.id === row.venue.id).capacity, isOpen: true },
    createdBy: row.origin === 'ADMIN' ? { id: 'u9', firstName: 'ธุรการ', lastName: 'ก' } : null,
    approvedBy:
      row.status === 'APPROVED' ? { id: 'u1', firstName: 'ผู้ทดสอบ', lastName: 'ระบบ' } : null,
    approvedAt: row.status === 'APPROVED' ? row.createdAt : null,
    conflicts: { approvedClash: row.id === 'b1', pendingLosers: losers },
  });
});

const mutate = (id, patch) => {
  const row = ROWS.find((r) => r.id === id);
  if (row) Object.assign(row, patch);
  return row;
};

app.post('/api/v1/booking-requests/:id/approve', requireWrite, (req, res) => {
  const row = mutate(req.params.id, { status: 'APPROVED' });
  if (!row) return res.status(404).json({ message: 'Booking not found.' });
  const losers = ROWS.filter(
    (o) => o.id !== row.id && o.status === 'PENDING' && o.venue.id === row.venue.id,
  ).slice(0, 2);
  losers.forEach((l) => {
    l.status = 'REJECTED';
    l.rejectReason = 'ทับซ้อนกับคำขอที่ได้รับอนุมัติ';
  });
  const actor = { id: 'u1', name: 'ผู้ทดสอบ ระบบ' };
  emit('bookingRequest.updated', { booking: row, actor });
  losers.forEach((l) => emit('bookingRequest.updated', { booking: l, actor }));
  res.json({ booking: row, autoRejected: losers.map((l) => ({ id: l.id, code: l.code })) });
});

app.post('/api/v1/booking-requests/:id/reject', requireWrite, (req, res) => {
  const row = mutate(req.params.id, {
    status: 'REJECTED',
    rejectReason: String(req.body?.reason ?? '').trim(),
  });
  if (!row) return res.status(404).json({ message: 'Booking not found.' });
  emit('bookingRequest.updated', { booking: row, actor: { id: 'u1', name: 'ผู้ทดสอบ ระบบ' } });
  res.json(row);
});

app.post('/api/v1/booking-requests/:id/cancel', requireWrite, (req, res) => {
  const row = ROWS.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ message: 'Booking not found.' });
  const ids = req.body?.slotIds;
  row.slots.forEach((s) => {
    if (!ids || ids.includes(s.id)) {
      s.isCancelled = true;
      s.cancelledAt = new Date().toISOString();
      s.cancelReason = String(req.body?.reason ?? '').trim();
      s.cancelledByRole = role;
    }
  });
  if (row.slots.every((s) => s.isCancelled)) row.status = 'CANCELLED';
  emit('bookingRequest.updated', { booking: row, actor: { id: 'u1', name: 'ผู้ทดสอบ ระบบ' } });
  res.json(row);
});

app.post('/api/v1/booking-requests/preflight', (req, res) => {
  const v = VENUES.find((x) => x.id === req.body?.venueId);
  const clash = req.body?.venueId === 'v2';
  res.json({
    hasApprovedClash: clash,
    approvedClashCount: clash ? 2 : 0,
    overlappingPendingRequests: clash
      ? []
      : ROWS.filter((r) => r.status === 'PENDING' && r.venue.id === req.body?.venueId)
          .slice(0, 2)
          .map((r) => ({
            id: r.id,
            code: r.code,
            purpose: r.purpose,
            requesterName: r.requester.name,
          })),
    venueIsOpen: v ? v.isOpen : true,
  });
});

app.post('/api/v1/booking-requests/direct', requireWrite, (req, res) => {
  const v = VENUES.find((x) => x.id === req.body?.venueId) ?? VENUES[0];
  const row = {
    ...ROWS[0],
    id: `b${Date.now()}`,
    code: `BR-25690906-${String(ROWS.length + 1).padStart(3, '0')}`,
    status: 'APPROVED',
    origin: 'ADMIN',
    venue: { id: v.id, name: v.name, location: v.location },
    purpose: req.body?.purpose ?? 'จองโดยเจ้าหน้าที่',
    attendees: req.body?.attendees ?? 10,
    createdAt: new Date().toISOString(),
  };
  ROWS.unshift(row);
  emit('bookingRequest.created', { booking: row, actor: { id: 'u1', name: 'ผู้ทดสอบ ระบบ' } });
  res.status(201).json(row);
});

/* ── announcements (ประกาศและข่าวสาร: phase 3 reads, phase 4 writes) ───── */

/**
 * Seed for `GET /announcements`. Every row is EXACTLY `AnnouncementDto` — twelve keys, nothing more:
 * `id, title, body, format, status, audience, department, sentAt, sentCount, createdBy, createdAt,
 * updatedAt`. `department` is `AnnouncementDepartmentDto` (`{id,name}` — never the option table's
 * full row) and `createdBy` is `AnnouncementCreatorDto` (`{id,firstName,lastName}`).
 *
 * 14 SENT + 10 DRAFT = 24, so the three pills are distinguishable (24 / 14 / 10) and the list has three
 * pages at `limit=10`. Ids are `cmfann001…024x7k2q9w4e1r5t8y0` in the order below. Deliberately
 * included, one each or more:
 *   · DEPARTMENT with `department: null` — a hard-deleted department → `(ถูกลบแล้ว)` (two rows)
 *   · a 100-character title with no spaces — the 390px overflow check
 *   · a SENT row with a small partial `sentCount` (7) — rendered as-is, never hidden
 *   · `createdBy: null` — a hard-deleted staff account
 *   · a title-only draft (`body: ''`)
 *   · a DRAFT whose `department` is NOT in `DEPARTMENTS` (id 9, soft-deleted) — the dialog's
 *     `(ไม่พร้อมใช้งาน)` path; PATCH and send refuse it, as the real server re-validates (phase 4)
 * `dept` below: absent → ALL; a number → that stub `DEPARTMENTS` row; `'gone'` → DEPARTMENT + null;
 * an object → that literal `{id,name}`, whether or not the option table still has it.
 */
const LONG_ANNOUNCEMENT_TITLE = 'ประกาศด่วนเรื่องการปิดปรับปรุงหอประชุมวารณและห้องประชุมไอยราพรต'
  .repeat(2)
  .slice(0, 100);

const STAFF_A = { id: 'su0', firstName: 'ผู้ทดสอบ', lastName: 'ระบบ' };
const STAFF_B = { id: 'su1', firstName: 'เจ้าหน้าที่', lastName: 'คนที่ 2' };

const ANNOUNCEMENT_SPECS = [
  // ── SENT (14) ──
  { title: 'ปิดปรับปรุงหอประชุมวารณ วันที่ 25 ก.ย. 2569', status: 'SENT', format: 'TEXT', sent: 1248, at: [20, 9, 0] },
  { title: 'เปิดให้จองห้องประชุมไอยราพรตผ่าน LINE แล้ว', status: 'SENT', format: 'FLEX', sent: 1236, at: [19, 14, 30] },
  { title: 'ประชุมผู้ปกครองประจำภาคเรียนที่ 2', status: 'SENT', format: 'TEXT', dept: 1, sent: 312, at: [18, 10, 0] },
  { title: 'ขอเชิญร่วมกิจกรรมวันวิทยาศาสตร์', status: 'SENT', format: 'FLEX', dept: 2, sent: 187, at: [17, 8, 45] },
  { title: 'แจ้งเปลี่ยนเวลาเปิดโรงยิม 1', status: 'SENT', format: 'TEXT', sent: 7, at: [16, 16, 10] },
  { title: LONG_ANNOUNCEMENT_TITLE, status: 'SENT', format: 'TEXT', sent: 1190, at: [15, 11, 0] },
  { title: 'กำหนดการซ้อมกีฬาสีประจำปี 2569', status: 'SENT', format: 'FLEX', dept: 'gone', sent: 95, at: [14, 9, 20] },
  { title: 'งดใช้ลานกิจกรรมช่วงสอบกลางภาค', status: 'SENT', format: 'TEXT', sent: 1201, at: [12, 13, 0], by: STAFF_B },
  { title: 'อบรมการใช้งานระบบจองสถานที่สำหรับครู', status: 'SENT', format: 'TEXT', dept: 2, sent: 64, at: [11, 10, 30] },
  { title: 'แจ้งปิดระบบชั่วคราวเพื่อบำรุงรักษา', status: 'SENT', format: 'FLEX', sent: 1255, at: [10, 17, 0] },
  { title: 'ประกาศผลการจัดสรรห้องเรียนพิเศษ', status: 'SENT', format: 'TEXT', dept: 1, sent: 208, at: [8, 9, 0], by: STAFF_B },
  { title: 'เชิญชมการแสดงดนตรีไทยในหอประชุม', status: 'SENT', format: 'FLEX', sent: 1172, at: [6, 15, 0] },
  { title: 'รับสมัครอาสาสมัครดูแลสนามฟุตซอล', status: 'SENT', format: 'TEXT', sent: 1160, at: [4, 11, 15] },
  { title: 'ปรับปรุงระบบเสียงในห้องประชุมเสร็จแล้ว', status: 'SENT', format: 'TEXT', sent: 1149, at: [2, 10, 0] },
  // ── DRAFT (10) ──
  { title: 'กำหนดการสอบปลายภาค ภาคเรียนที่ 2', status: 'DRAFT', format: 'TEXT', at: [21, 10, 0] },
  { title: 'เปิดจองสนามฟุตซอลช่วงปิดภาคเรียน', status: 'DRAFT', format: 'FLEX', at: [21, 8, 30] },
  { title: 'ประชุมกลุ่มสาระวิทยาศาสตร์ประจำเดือนตุลาคม', status: 'DRAFT', format: 'TEXT', dept: 2, at: [20, 15, 0] },
  { title: 'แนวปฏิบัติการใช้หอประชุมหลังเวลาราชการ', status: 'DRAFT', format: 'TEXT', body: '', at: [18, 16, 40] },
  { title: 'ขอความร่วมมือคืนอุปกรณ์เครื่องเสียง', status: 'DRAFT', format: 'FLEX', dept: 1, at: [16, 9, 0], by: STAFF_B },
  { title: 'แจ้งตารางเวรดูแลห้องประชุม', status: 'DRAFT', format: 'TEXT', dept: 'gone', at: [13, 14, 0] },
  { title: 'กิจกรรมวันเด็กแห่งชาติ 2570', status: 'DRAFT', format: 'FLEX', at: [9, 11, 0], by: null },
  { title: 'ปรับเวลาเปิด-ปิดโดมเขียว', status: 'DRAFT', format: 'TEXT', at: [7, 13, 30] },
  { title: 'ประกาศรายชื่อผู้ได้รับทุนการศึกษา', status: 'DRAFT', format: 'TEXT', dept: 1, at: [3, 9, 0] },
  // Appended LAST so every earlier id keeps its number (this one is `cmfann024…`).
  { title: 'นัดประชุมฝ่ายโสตทัศนูปกรณ์', status: 'DRAFT', format: 'TEXT', dept: { id: 9, name: 'ฝ่ายโสตทัศนูปกรณ์' }, at: [5, 10, 0] },
];

function announcementSeed() {
  return ANNOUNCEMENT_SPECS.map((s, i) => {
    const createdAt = iso(...s.at);
    const sentAt = s.status === 'SENT' ? iso(s.at[0], s.at[1] + 1, s.at[2]) : null;
    const department =
      s.dept === undefined || s.dept === 'gone'
        ? null
        : typeof s.dept === 'object'
          ? { id: s.dept.id, name: s.dept.name }
          : (({ id, name }) => ({ id, name }))(findDept(s.dept));
    return {
      id: `cmfann${String(i + 1).padStart(3, '0')}x7k2q9w4e1r5t8y0`,
      title: s.title,
      body: s.body ?? `${s.title} — รายละเอียดเพิ่มเติมติดต่อฝ่ายอาคารสถานที่`,
      format: s.format,
      status: s.status,
      audience: s.dept === undefined ? 'ALL' : 'DEPARTMENT',
      department,
      sentAt,
      sentCount: s.status === 'SENT' ? s.sent : 0,
      createdBy: s.by === undefined ? STAFF_A : s.by,
      createdAt,
      updatedAt: sentAt ?? iso(s.at[0], s.at[1], s.at[2] + 5),
    };
  });
}

let ANNOUNCEMENTS = announcementSeed();

/** `botMode` → what `GET /announcements/line-bot-info` answers. `ok` is the default. */
const BOT_MODES = ['ok', 'ok-picture', 'bot', 'not-configured', 'unavailable', 'no-code', 'network'];
/** `listMode` → what every `GET /announcements` answers (the two count calls included). */
const LIST_MODES = ['ok', 'empty', 'fail'];

let botMode = 'ok';
let listMode = 'ok';

/** The house body the real stack answers when the session store is down — NO `code` key. */
const SESSION_STORE_DOWN = {
  statusCode: 503,
  error: 'Service Unavailable',
  message: 'Session store unavailable.',
};

/** `LineBotInfoDto` — exactly four keys. `pictureUrl` is null unless `botMode` is `ok-picture`. */
const LINE_BOT_INFO = {
  basicId: '@easybook',
  displayName: 'EasyBook School OA',
  pictureUrl: null,
  chatMode: 'chat',
};

/**
 * `ListAnnouncementsQueryDto` under the real global pipe (`whitelist`, `forbidNonWhitelisted`,
 * `transform`). Returns the parsed query, or the class-validator `message` ARRAY for a 400.
 * `@Type(() => Number)` means `page=abc` is NaN and `page=` is 0 — both refused, never defaulted.
 */
const ANNOUNCEMENT_QUERY_KEYS = ['page', 'limit', 'status', 'q'];

function parseAnnouncementQuery(query) {
  const errors = [];
  for (const key of Object.keys(query)) {
    if (!ANNOUNCEMENT_QUERY_KEYS.includes(key)) errors.push(`property ${key} should not exist`);
  }

  let page = 1;
  if (query.page !== undefined) {
    page = Number(query.page);
    if (!Number.isInteger(page)) errors.push('page must be an integer number');
    if (!(page >= 1)) errors.push('page must not be less than 1');
  }

  let limit = 10;
  if (query.limit !== undefined) {
    limit = Number(query.limit);
    if (!Number.isInteger(limit)) errors.push('limit must be an integer number');
    if (![10, 20, 50].includes(limit)) {
      errors.push('limit must be one of the following values: 10, 20, 50');
    }
  }

  const status = query.status ?? 'all';
  if (!['all', 'sent', 'draft'].includes(status)) {
    errors.push('status must be one of the following values: all, sent, draft');
  }

  let q;
  if (query.q !== undefined) {
    if (typeof query.q !== 'string') {
      errors.push('q must be a string');
    } else {
      q = query.q.trim();
      if (q.length > 100) errors.push('q must be shorter than or equal to 100 characters');
    }
  }

  return errors.length ? { errors } : { page, limit, status, q };
}

/** Mirrors `@Roles(SUPER_ADMIN, ADMIN, VIEWER)` — every role reads, so there is no guard here. */
app.get('/api/v1/announcements', (req, res) => {
  const parsed = parseAnnouncementQuery(req.query);
  if (parsed.errors) {
    return res.status(400).json({ statusCode: 400, message: parsed.errors, error: 'Bad Request' });
  }
  if (listMode === 'fail') return res.status(503).json(SESSION_STORE_DOWN);

  const { page, limit, status, q } = parsed;
  let out = listMode === 'empty' ? [] : ANNOUNCEMENTS.slice();
  if (status === 'sent') out = out.filter((a) => a.status === 'SENT');
  if (status === 'draft') out = out.filter((a) => a.status === 'DRAFT');
  // Title ONLY, never `body`, case-insensitive; an empty `q` after trimming is no filter.
  if (q) out = out.filter((a) => a.title.toLowerCase().includes(q.toLowerCase()));
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const total = out.length;
  // A page past the end is `data: []` with a correct `meta` — NOT clamped (that is the client's job).
  res.json({
    data: out.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * Mirrors `@Roles(SUPER_ADMIN, ADMIN, VIEWER)`. 🔴 Registered BEFORE any future `/:id` route, as in
 * the real controller (D-H) — or `line-bot-info` would be read as an id.
 */
app.get('/api/v1/announcements/line-bot-info', (req, res) => {
  switch (botMode) {
    case 'ok-picture':
      return res.json({
        ...LINE_BOT_INFO,
        pictureUrl: `http://localhost:${PORT}/__assets/line-oa.svg`,
      });
    case 'bot':
      return res.json({ ...LINE_BOT_INFO, chatMode: 'bot' });
    case 'not-configured':
      return res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'The LINE Official Account is not configured or its access token was rejected.',
        code: 'LINE_NOT_CONFIGURED',
      });
    case 'unavailable':
      return res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'The LINE Official Account details are unavailable right now.',
        code: 'LINE_BOT_INFO_UNAVAILABLE',
      });
    case 'no-code':
      return res.status(503).json(SESSION_STORE_DOWN);
    case 'network':
      // No status at all: the fetch rejects, and the app sees a network failure. This works only
      // because `.env.stub` points the app straight at :3301 — no Vite proxy to answer 502 instead.
      return req.socket.destroy();
    default:
      return res.json(LINE_BOT_INFO);
  }
});

/**
 * The OA picture for `botMode=ok-picture`, served from here so the check needs no internet. NOT
 * part of the contract (hence `__`). A flat disc with a letter — deliberately unlike the app's
 * initial fallback, so "the image rendered" is obvious at a glance.
 */
app.get('/__assets/line-oa.svg', (_req, res) => {
  res
    .type('image/svg+xml')
    .send(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#06c755"/><text x="48" y="62" font-family="sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="#ffffff">EB</text></svg>',
    );
});

/* ── announcements, phase 4: GET :id and the four writes ──────────────── */

/** `createdBy` of a row created here — the same person `GET /auth/system/me` answers. */
const STUB_AUTHOR = { id: 'u1', firstName: 'ผู้ทดสอบ', lastName: 'ระบบ' };

/** `easybook-service/src/announcements/announcements.constants.ts`, VERBATIM (as of ANNOUNCE-API-5). */
const MSG = {
  NOT_FOUND: 'Announcement not found.',
  /** PATCH only since ANNOUNCE-API-5 — a SENT row can be deleted now. */
  SENT_IMMUTABLE: 'A sent announcement cannot be edited.',
  DEPT_REQUIRED: 'departmentId is required when audience is DEPARTMENT.',
  DEPT_NOT_ALLOWED: 'departmentId must be null when audience is ALL.',
  DEPT_INVALID: 'The selected department does not exist or is not available.',
  UPDATE_EMPTY: 'Provide at least one field to update.',
  BODY_REQUIRED: 'An announcement needs a body before it can be sent.',
  IN_PROGRESS: 'This announcement is being sent or edited right now. Try again in a moment.',
  ALREADY_SENT: 'This announcement has already been sent.',
  PARTIAL:
    'LINE accepted the announcement for only some recipients. It is marked as sent and cannot be sent again.',
  LINE_FAILED: 'LINE did not accept the announcement. It was not marked as sent; please try again.',
  NOT_CONFIGURED: 'The LINE Official Account is not configured or its access token was rejected.',
  RATE_LIMITED:
    'LINE refused the request because a rate limit or the monthly message quota was reached.',
};

const ERR = {
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

/**
 * GET :id, POST and PATCH answer the house body — NO `code` key. DELETE's 404/409 are coded since
 * ANNOUNCE-API-5, and so are the canned-reply service errors (their pipe 400s stay house).
 */
const house = (s, message) => ({ statusCode: s, message, error: ERR[s] });

/** The coded body, in this key order (plan D-12), plus the partial-send counts. */
const coded = (s, code, message, extra = {}) => ({ statusCode: s, error: ERR[s], message, code, ...extra });

const SEND_MODES = [
  'ok',
  'zero-recipients',
  'partial',
  'line-failed',
  'not-configured',
  'rate-limited',
  'no-code',
  'in-progress',
  'already-sent',
  'network',
  'network-after-commit',
];
const SAVE_MODES = ['ok', 'no-code', 'network'];
/** `DELETE /announcements/:id` once the row exists (ANNOUNCE-API-5's `FOR UPDATE NOWAIT`). */
const DELETE_MODES = ['ok', 'in-progress'];
const CSRF_MODES = ['ok', 'reject'];
const MUTATE_ACTIONS = ['delete', 'markSent', 'clearBody'];
const SEND_DELAY_MAX = 10_000;

let sendMode = 'ok';
let sendDelayMs = 0;
let saveMode = 'ok';
let deleteMode = 'ok';
let csrfMode = 'ok';
/** The next created row's number — `cmfann100…`, which no seed id can collide with. */
let nextId = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const findAnnouncement = (id) => ANNOUNCEMENTS.find((a) => a.id === id);

/** What a committed send writes. `count` is the partial send's accepted number. */
function commitSent(row, count) {
  const now = new Date().toISOString();
  row.status = 'SENT';
  row.sentAt = now;
  row.updatedAt = now;
  row.sentCount = count ?? (row.audience === 'ALL' ? 1248 : 42);
}

/**
 * POST/PATCH/DELETE only — NOT send. The session store fails before anything else, so nothing is
 * written. `network` drops the socket: no status at all reaches the app.
 */
const saveGate = (req, res, next) => {
  if (saveMode === 'no-code') return res.status(503).json(SESSION_STORE_DOWN);
  if (saveMode === 'network') return req.socket.destroy();
  next();
};

/**
 * The double-submit check, on the five announcement writes and the three canned-reply writes ONLY
 * (A-16). In the real stack CSRF runs before the role guard, so a VIEWER with a bad token also gets
 * THIS 403. A FACTORY, so the announcement and canned `csrfMode`s stay independent (ANNOUNCE-UI-6).
 */
const csrfCheck = (modeOf) => (req, res, next) => {
  if (modeOf() === 'reject' || req.get('x-csrf-token') !== CSRF_TOKEN) {
    return res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token.', error: 'Forbidden' });
  }
  next();
};

const requireCsrf = csrfCheck(() => csrfMode);

const ANNOUNCEMENT_BODY_KEYS = ['title', 'body', 'format', 'audience', 'departmentId'];
const ANNOUNCEMENT_FORMATS = ['TEXT', 'FLEX'];
const ANNOUNCEMENT_AUDIENCES = ['ALL', 'DEPARTMENT'];
const DEPARTMENT_ID_MAX = 2_147_483_647;

/**
 * `CreateAnnouncementDto` (`partial` false) / `UpdateAnnouncementDto` (`partial` true) under the
 * real global pipe (`whitelist`, `forbidNonWhitelisted`, `transform`) — the class-validator messages.
 * Returns `{ errors }` (the 400's `message` ARRAY) or `{ value }` holding ONLY the keys that were
 * present, `title`/`body` trimmed (`@Transform(trim)` runs before validation). `null` is a present
 * value: a 400 everywhere except `departmentId`.
 */
function parseAnnouncementBody(raw, partial) {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = [];
  const value = {};
  for (const key of Object.keys(body)) {
    if (!ANNOUNCEMENT_BODY_KEYS.includes(key)) errors.push(`property ${key} should not exist`);
  }
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);

  if (!partial || body.title !== undefined) {
    const t = trim(body.title);
    if (typeof t !== 'string') errors.push('title must be a string');
    if (t === undefined || t === null || t === '') errors.push('title should not be empty');
    if (typeof t !== 'string' || t.length > 100) {
      errors.push('title must be shorter than or equal to 100 characters');
    }
    value.title = t;
  }
  if (body.body !== undefined) {
    const b = trim(body.body);
    if (typeof b !== 'string') errors.push('body must be a string');
    if (typeof b !== 'string' || b.length > 1000) {
      errors.push('body must be shorter than or equal to 1000 characters');
    }
    value.body = b;
  }
  if (body.format !== undefined) {
    if (!ANNOUNCEMENT_FORMATS.includes(body.format)) {
      errors.push(`format must be one of the following values: ${ANNOUNCEMENT_FORMATS.join(', ')}`);
    }
    value.format = body.format;
  }
  if (body.audience !== undefined) {
    if (!ANNOUNCEMENT_AUDIENCES.includes(body.audience)) {
      errors.push(`audience must be one of the following values: ${ANNOUNCEMENT_AUDIENCES.join(', ')}`);
    }
    value.audience = body.audience;
  }
  if (body.departmentId !== undefined) {
    const d = body.departmentId;
    // A JSON string such as "3" is a 400 — the pipe does no implicit conversion here.
    if (d !== null) {
      if (typeof d !== 'number' || !Number.isInteger(d)) {
        errors.push('departmentId must be an integer number');
      } else {
        if (d < 1) errors.push('departmentId must not be less than 1');
        if (d > DEPARTMENT_ID_MAX) errors.push(`departmentId must not be greater than ${DEPARTMENT_ID_MAX}`);
      }
    }
    value.departmentId = d;
  }
  return errors.length ? { errors } : { value };
}

/** The `{id,name}` of an ACTIVE department this role may target, or `null` (one indistinguishable 400). */
const targetableDept = (id) => {
  const d = activeDeptsFor(role).find((x) => x.id === id);
  return d ? { id: d.id, name: d.name } : null;
};

/** Mirrors `@Roles(SUPER_ADMIN, ADMIN, VIEWER)`. Registered AFTER `line-bot-info` (see above). */
app.get('/api/v1/announcements/:id', (req, res) => {
  const row = findAnnouncement(req.params.id);
  if (!row) return res.status(404).json(house(404, MSG.NOT_FOUND));
  res.json(row);
});

/** 201 with the full 12-key `AnnouncementDto`, status DRAFT, `createdBy` = the stub user. */
app.post('/api/v1/announcements', saveGate, requireCsrf, requireWrite, (req, res) => {
  const parsed = parseAnnouncementBody(req.body, false);
  if (parsed.errors) return res.status(400).json(house(400, parsed.errors));
  const v = parsed.value;

  const audience = v.audience ?? 'ALL';
  const deptId = v.departmentId ?? null;
  if (audience === 'DEPARTMENT' && deptId === null) return res.status(400).json(house(400, MSG.DEPT_REQUIRED));
  if (audience === 'ALL' && deptId !== null) return res.status(400).json(house(400, MSG.DEPT_NOT_ALLOWED));
  let department = null;
  if (audience === 'DEPARTMENT') {
    department = targetableDept(deptId);
    if (!department) return res.status(400).json(house(400, MSG.DEPT_INVALID));
  }

  const now = new Date().toISOString();
  const row = {
    id: `cmfann${String(nextId++).padStart(3, '0')}x7k2q9w4e1r5t8y0`,
    title: v.title,
    body: v.body ?? '',
    format: v.format ?? 'TEXT',
    status: 'DRAFT',
    audience,
    department,
    sentAt: null,
    sentCount: 0,
    createdBy: { ...STUB_AUTHOR },
    createdAt: now,
    updatedAt: now,
  };
  ANNOUNCEMENTS.unshift(row);
  res.status(201).json(row);
});

/**
 * The real service's order: DTO → all five absent (`UPDATE_EMPTY`) → 404 → 409 SENT → the MERGED
 * audience rule. An omitted `departmentId` keeps the stored one AND RE-VALIDATES it, so an unchanged
 * save of the soft-deleted-department seed is refused, as the real server does.
 */
app.patch('/api/v1/announcements/:id', saveGate, requireCsrf, requireWrite, (req, res) => {
  const parsed = parseAnnouncementBody(req.body, true);
  if (parsed.errors) return res.status(400).json(house(400, parsed.errors));
  const v = parsed.value;
  if (Object.keys(v).length === 0) return res.status(400).json(house(400, MSG.UPDATE_EMPTY));

  const row = findAnnouncement(req.params.id);
  if (!row) return res.status(404).json(house(404, MSG.NOT_FOUND));
  if (row.status === 'SENT') return res.status(409).json(house(409, MSG.SENT_IMMUTABLE));

  const audience = v.audience ?? row.audience;
  let department = null;
  if (audience === 'ALL') {
    if (v.departmentId !== undefined && v.departmentId !== null) {
      return res.status(400).json(house(400, MSG.DEPT_NOT_ALLOWED));
    }
  } else {
    const id = v.departmentId !== undefined ? v.departmentId : (row.department?.id ?? null);
    if (id === null) return res.status(400).json(house(400, MSG.DEPT_REQUIRED));
    department = targetableDept(id);
    if (!department) return res.status(400).json(house(400, MSG.DEPT_INVALID));
  }

  if (v.title !== undefined) row.title = v.title;
  if (v.body !== undefined) row.body = v.body;
  if (v.format !== undefined) row.format = v.format;
  row.audience = audience;
  row.department = department;
  row.updatedAt = new Date().toISOString();
  res.json(row);
});

/**
 * ANNOUNCE-API-5: a SOFT delete of a DRAFT **or** a SENT row → 204 with an EMPTY body. `splice` is
 * indistinguishable from a soft delete through the API (gone from list, counts, GET :id, PATCH, send
 * and a second DELETE) and keeps every row at exactly twelve keys (design S-11).
 *
 * Order (design S-12): 404 BEFORE `deleteMode: in-progress` — the real `FOR UPDATE NOWAIT` only locks
 * live rows, so a missing row answers 404 and never contends for the lock.
 */
app.delete('/api/v1/announcements/:id', saveGate, requireCsrf, requireWrite, (req, res) => {
  const row = findAnnouncement(req.params.id);
  if (!row) return res.status(404).json(coded(404, 'ANNOUNCEMENT_NOT_FOUND', MSG.NOT_FOUND));
  if (deleteMode === 'in-progress') {
    return res.status(409).json(coded(409, 'ANNOUNCEMENT_SEND_IN_PROGRESS', MSG.IN_PROGRESS));
  }
  ANNOUNCEMENTS.splice(ANNOUNCEMENTS.indexOf(row), 1);
  res.status(204).end();
});

/**
 * Phase 2 D-D's order: (session store) → 404 → 409 in progress → 409 already sent → 400 body →
 * 400 department → the outcome `sendMode` picks. No `saveGate`: `saveMode` never touches a send.
 * `sendMode` is read ONCE, when the request arrives.
 */
app.post('/api/v1/announcements/:id/send', requireCsrf, requireWrite, async (req, res) => {
  const mode = sendMode;
  if (mode === 'no-code') return res.status(503).json(SESSION_STORE_DOWN);
  if (sendDelayMs > 0) await sleep(sendDelayMs);

  const row = findAnnouncement(req.params.id);
  if (!row) return res.status(404).json(coded(404, 'ANNOUNCEMENT_NOT_FOUND', MSG.NOT_FOUND));
  if (mode === 'in-progress') {
    return res.status(409).json(coded(409, 'ANNOUNCEMENT_SEND_IN_PROGRESS', MSG.IN_PROGRESS));
  }
  // A-14: another admin got there first — COMMITTED, so the app's `GET :id` re-read agrees.
  if (mode === 'already-sent' && row.status !== 'SENT') commitSent(row);
  if (row.status === 'SENT') {
    return res.status(409).json(coded(409, 'ANNOUNCEMENT_ALREADY_SENT', MSG.ALREADY_SENT));
  }
  if (row.body.trim() === '') {
    return res.status(400).json(coded(400, 'ANNOUNCEMENT_BODY_REQUIRED', MSG.BODY_REQUIRED));
  }
  // The real send checks only `deletedAt` — reserved rows INCLUDED, whoever the actor is.
  const everyDept = [...DEPARTMENTS, ...RESERVED_DEPARTMENTS];
  if (
    row.audience === 'DEPARTMENT' &&
    (row.department === null || !everyDept.some((d) => d.id === row.department.id))
  ) {
    return res.status(400).json(coded(400, 'ANNOUNCEMENT_DEPARTMENT_INVALID', MSG.DEPT_INVALID));
  }

  switch (mode) {
    case 'zero-recipients':
      // ANNOUNCE-API-5: nobody eligible → 200, SENT, `sentCount` 0, no LINE call. ⚠️ `commitSent`
      // uses `count ?? …`, so the 0 survives — never change that to `||`.
      commitSent(row, 0);
      return res.json(row);
    case 'partial':
      commitSent(row, 500);
      return res
        .status(502)
        .json(coded(502, 'ANNOUNCEMENT_PARTIALLY_SENT', MSG.PARTIAL, { acceptedCount: 500, targetedCount: 734 }));
    case 'line-failed':
      return res.status(502).json(coded(502, 'LINE_SEND_FAILED', MSG.LINE_FAILED));
    case 'not-configured':
      return res.status(503).json(coded(503, 'LINE_NOT_CONFIGURED', MSG.NOT_CONFIGURED));
    case 'rate-limited':
      return res.status(503).json(coded(503, 'LINE_RATE_LIMITED', MSG.RATE_LIMITED));
    case 'network':
      // No status at all; the row stays DRAFT. Works because `.env.stub` points straight at :3301.
      return req.socket.destroy();
    case 'network-after-commit':
      // The server DID send, and the answer never arrived — the app must say "unknown", not "failed".
      commitSent(row);
      return req.socket.destroy();
    default:
      commitSent(row);
      return res.json(row);
  }
});

/* ── canned replies (ข้อความตอบกลับด่วน: ANNOUNCE-API-5, ANNOUNCE-UI-6) ───── */

/**
 * The four defaults the migration seeds — `easybook-service/prisma/migrations/20260922115151_add_
 * canned_replies_table/migration.sql`. ⚠️ COPIED PROGRAMMATICALLY and compared with `===`, never
 * retyped: they contain ASCII `"`, en dashes (`–`) and `08:30–16:30 น.`, which a retype quietly
 * "fixes". UTF-16 lengths: titles 18/21/22/18, texts 150/126/125/125.
 */
const CANNED_DEFAULTS = [
  {
    title: 'แจ้งวิธีจองสถานที่',
    text:
      'สวัสดีค่ะ จองสถานที่ได้ที่เมนู "จองสถานที่" ด้านล่างห้องแชทนี้ เลือกสถานที่ วันและเวลา แล้วกดยืนยัน ระบบจะแจ้งผลการอนุมัติทาง LINE ภายใน 1 วันทำการค่ะ',
  },
  {
    title: 'แจ้งเงื่อนไขการยกเลิก',
    text:
      'ยกเลิกการจองได้เองที่เมนู "การจองของฉัน" ก่อนเวลาใช้งานอย่างน้อย 24 ชั่วโมง หากน้อยกว่านั้นกรุณาติดต่อเจ้าหน้าที่ผ่านแชทนี้ค่ะ',
  },
  {
    title: 'แจ้งสถานะคำขอรออนุมัติ',
    text:
      'ได้รับคำขอจองของท่านแล้วค่ะ ขณะนี้อยู่ระหว่างรอเจ้าหน้าที่อนุมัติ เมื่อพิจารณาแล้วระบบจะแจ้งผลให้ทราบทาง LINE โดยอัตโนมัติค่ะ',
  },
  {
    title: 'ติดต่อนอกเวลาทำการ',
    text:
      'ขอบคุณที่ติดต่อมาค่ะ ขณะนี้อยู่นอกเวลาทำการ (จันทร์–ศุกร์ 08:30–16:30 น.) เจ้าหน้าที่จะตอบกลับโดยเร็วที่สุดในวันทำการถัดไปค่ะ',
  },
];

/** One shared stamp for both dates of every seed row (design §6.2). */
const CANNED_STAMP = '2026-09-22T08:00:00.000Z';

/** `CannedReplyDto` — EXACTLY six keys. Ids `canned_reply_default_1…4`, `sortOrder` 0–3. */
function cannedSeed() {
  return CANNED_DEFAULTS.map((d, i) => ({
    id: `canned_reply_default_${i + 1}`,
    title: d.title,
    text: d.text,
    sortOrder: i,
    createdAt: CANNED_STAMP,
    updatedAt: CANNED_STAMP,
  }));
}

let CANNED = cannedSeed();
/** The next created row's number — `cmfcan100…`, which no seed id can collide with. */
let nextCannedId = 100;

/** `easybook-service/src/canned-replies/canned-replies.constants.ts`, VERBATIM. */
const CANNED_MAX = 5;
const CANNED_TITLE_MAX = 100;
const CANNED_TEXT_MAX = 1000;
const CANNED_SORT_ORDER_MAX = 9999;
const CANNED_MSG = {
  LIMIT: 'ข้อความตอบกลับด่วนสามารถมีได้สูงสุดไม่เกิน 5 ข้อความ',
  NOT_FOUND: 'Canned reply not found.',
  UPDATE_EMPTY: 'Provide at least one field to update.',
};

const CANNED_LIST_MODES = ['ok', 'error', 'network'];
const CANNED_CREATE_MODES = ['ok', 'limit'];
const CANNED_SAVE_MODES = ['ok', 'no-code', 'network'];
const CANNED_DELAY_MAX = 10_000;

let cannedListMode = 'ok';
let cannedCreateMode = 'ok';
let cannedSaveMode = 'ok';
let cannedCsrfMode = 'ok';
let cannedDelayMs = 0;

const findCanned = (id) => CANNED.find((r) => r.id === id);

/** The service's order: `sortOrder ASC`, then `createdAt ASC`, then `id ASC`. */
const cannedOrder = (a, b) =>
  a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** An omitted `sortOrder` → the bottom: `min(max + 1, 9999)`, or 0 on an empty table (backend S-4). */
const nextSortOrder = () =>
  CANNED.length ? Math.min(Math.max(...CANNED.map((r) => r.sortOrder)) + 1, CANNED_SORT_ORDER_MAX) : 0;

/** Slept before EVERY canned route answers, GET included (design S-10). */
const cannedDelay = async (_req, _res, next) => {
  if (cannedDelayMs > 0) await sleep(cannedDelayMs);
  next();
};

/** GET: the session store fails (code-less 503), or the socket drops. */
const cannedListGate = (req, res, next) => {
  if (cannedListMode === 'error') return res.status(503).json(SESSION_STORE_DOWN);
  if (cannedListMode === 'network') return req.socket.destroy();
  next();
};

/** POST / PATCH / DELETE: the same, before anything is written. */
const cannedSaveGate = (req, res, next) => {
  if (cannedSaveMode === 'no-code') return res.status(503).json(SESSION_STORE_DOWN);
  if (cannedSaveMode === 'network') return req.socket.destroy();
  next();
};

const cannedCsrf = csrfCheck(() => cannedCsrfMode);

const CANNED_BODY_KEYS = ['title', 'text', 'sortOrder'];

/**
 * `CreateCannedReplyDto` (`partial` false) / `UpdateCannedReplyDto` (`partial` true) under the real
 * global pipe (`whitelist`, `forbidNonWhitelisted`, `transform`) — the class-validator messages.
 * Returns `{ errors }` (the 400's `message` ARRAY, no `code`) or `{ value }` holding ONLY the keys
 * that were present, `title`/`text` trimmed. `null` is a PRESENT value (`@ValidateIf(v !== undefined)`)
 * and is refused everywhere. `sortOrder` gets no conversion: a JSON `"3"` is a 400.
 */
function parseCannedBody(raw, partial) {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const errors = [];
  const value = {};
  for (const key of Object.keys(body)) {
    if (!CANNED_BODY_KEYS.includes(key)) errors.push(`property ${key} should not exist`);
  }
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);

  for (const [key, max] of [
    ['title', CANNED_TITLE_MAX],
    ['text', CANNED_TEXT_MAX],
  ]) {
    if (partial && body[key] === undefined) continue;
    const v = trim(body[key]);
    if (typeof v !== 'string') errors.push(`${key} must be a string`);
    if (v === undefined || v === null || v === '') errors.push(`${key} should not be empty`);
    if (typeof v !== 'string' || v.length > max) {
      errors.push(`${key} must be shorter than or equal to ${max} characters`);
    }
    value[key] = v;
  }
  if (body.sortOrder !== undefined) {
    const s = body.sortOrder;
    // class-validator's `@Min` / `@Max` also fail on a non-number, hence the `typeof` in each.
    if (typeof s !== 'number' || !Number.isInteger(s)) errors.push('sortOrder must be an integer number');
    if (typeof s !== 'number' || s < 0) errors.push('sortOrder must not be less than 0');
    if (typeof s !== 'number' || s > CANNED_SORT_ORDER_MAX) {
      errors.push(`sortOrder must not be greater than ${CANNED_SORT_ORDER_MAX}`);
    }
    value.sortOrder = s;
  }
  return errors.length ? { errors } : { value };
}

/** Mirrors `@Roles(SUPER_ADMIN, ADMIN, VIEWER)`: a PLAIN array, in the server's order. */
app.get('/api/v1/canned-replies', cannedDelay, cannedListGate, (_req, res) => {
  res.json(CANNED.slice().sort(cannedOrder));
});

/**
 * Mirrors `@Roles(SUPER_ADMIN, ADMIN)`. Pipe 400 → limit (coded 400, at 5 rows or `createMode:
 * limit`) → 201 with the row. An omitted `sortOrder` puts it at the bottom.
 */
app.post('/api/v1/canned-replies', cannedDelay, cannedSaveGate, cannedCsrf, requireWrite, (req, res) => {
  const parsed = parseCannedBody(req.body, false);
  if (parsed.errors) return res.status(400).json(house(400, parsed.errors));
  if (cannedCreateMode === 'limit' || CANNED.length >= CANNED_MAX) {
    return res.status(400).json(coded(400, 'CANNED_REPLIES_LIMIT_EXCEEDED', CANNED_MSG.LIMIT));
  }
  const v = parsed.value;
  const now = new Date().toISOString();
  const row = {
    id: `cmfcan${String(nextCannedId++).padStart(3, '0')}x7k2q9w4e1r5t8y0`,
    title: v.title,
    text: v.text,
    sortOrder: v.sortOrder ?? nextSortOrder(),
    createdAt: now,
    updatedAt: now,
  };
  CANNED.push(row);
  res.status(201).json(row);
});

/** The service's order: pipe 400 → `{}` (coded `UPDATE_EMPTY`) → 404 (coded) → 200 with the row. */
app.patch('/api/v1/canned-replies/:id', cannedDelay, cannedSaveGate, cannedCsrf, requireWrite, (req, res) => {
  const parsed = parseCannedBody(req.body, true);
  if (parsed.errors) return res.status(400).json(house(400, parsed.errors));
  const v = parsed.value;
  if (Object.keys(v).length === 0) {
    return res.status(400).json(coded(400, 'CANNED_REPLY_UPDATE_EMPTY', CANNED_MSG.UPDATE_EMPTY));
  }
  const row = findCanned(req.params.id);
  if (!row) return res.status(404).json(coded(404, 'CANNED_REPLY_NOT_FOUND', CANNED_MSG.NOT_FOUND));
  if (v.title !== undefined) row.title = v.title;
  if (v.text !== undefined) row.text = v.text;
  if (v.sortOrder !== undefined) row.sortOrder = v.sortOrder;
  row.updatedAt = new Date().toISOString();
  res.json(row);
});

/** A HARD delete → 204 with an EMPTY body. Nothing re-seeds, even at zero rows. */
app.delete('/api/v1/canned-replies/:id', cannedDelay, cannedSaveGate, cannedCsrf, requireWrite, (req, res) => {
  const row = findCanned(req.params.id);
  if (!row) return res.status(404).json(coded(404, 'CANNED_REPLY_NOT_FOUND', CANNED_MSG.NOT_FOUND));
  CANNED.splice(CANNED.indexOf(row), 1);
  res.status(204).end();
});

/* ── control plane ─────────────────────────────────────────────────────── */

app.post('/__control/role', (req, res) => {
  role = req.body.role;
  res.json({ role });
});
/**
 * Set what `GET /api/v1/system/version` reports, so the version screen's disagreement state can be
 * exercised without editing this file.
 *
 * `version` is REQUIRED; `build` and `releasedAt` are optional and keep their current value when
 * omitted. All three must be non-empty strings.
 *
 * ⚠️ VALIDATED, AND APPLIED ALL-OR-NOTHING. A control route that stores whatever it is handed sets
 * `version: undefined` on a typo'd body, and `/api/v1/system/version` then serves a malformed
 * payload — which reads as a frontend bug on a screen that is actually fine. Building into `next`
 * and swapping at the end is what keeps a rejected `build` from leaving a half-applied `version`
 * behind.
 */
app.post('/__control/version', (req, res) => {
  const body = req.body ?? {};
  const next = { ...systemVersion };

  for (const field of ['version', 'build', 'releasedAt']) {
    const given = body[field];
    if (given === undefined) {
      if (field === 'version') {
        return res.status(400).json({ error: '`version` is required and must be a non-empty string' });
      }
      continue;
    }
    if (typeof given !== 'string' || given.trim() === '') {
      return res.status(400).json({ error: `\`${field}\` must be a non-empty string` });
    }
    next[field] = given.trim();
  }

  systemVersion = next;
  res.json(systemVersion);
});

/**
 * Force ประกาศและข่าวสาร into a state — any subset of:
 *   · `botMode` (the LINE OA card) and `listMode` (the list AND the two tab-count calls)
 *   · `sendMode`, `sendDelayMs`, `saveMode`, `deleteMode`, `csrfMode` (the writes; sticky until
 *     changed)
 *   · `mutate: { id, action }` — ANOTHER admin acting, once, right now: `delete` (a DRAFT or, since
 *     ANNOUNCE-API-5, a SENT row), `markSent` (a DRAFT sent elsewhere → the 409 paths) or `clearBody`
 *     (a DRAFT; A-19: the only way to reach the server's `ANNOUNCEMENT_BODY_REQUIRED`, since client
 *     validation always runs first)
 *
 * ⚠️ VALIDATED, AND APPLIED ALL-OR-NOTHING, like `/__control/version`: an unknown key (a typo such
 * as `botmode`) or an unknown value is a 400 and changes NOTHING — a control route that half-applies
 * leaves the screen in a state nobody asked for, which reads as a frontend bug.
 */
const ANNOUNCEMENT_CONTROL_KEYS = [
  'botMode',
  'listMode',
  'sendMode',
  'sendDelayMs',
  'saveMode',
  'deleteMode',
  'csrfMode',
  'mutate',
];

app.post('/__control/announcements', (req, res) => {
  const body = req.body ?? {};
  const keys = Object.keys(body);
  const unknown = keys.filter((k) => !ANNOUNCEMENT_CONTROL_KEYS.includes(k));
  if (unknown.length) {
    return res.status(400).json({ error: `unknown key(s): ${unknown.join(', ')}` });
  }
  if (!keys.length) {
    return res.status(400).json({ error: `give at least one of: ${ANNOUNCEMENT_CONTROL_KEYS.join(', ')}` });
  }
  const oneOf = (key, allowed) =>
    body[key] !== undefined && !allowed.includes(body[key])
      ? `\`${key}\` must be one of: ${allowed.join(', ')}`
      : null;
  const bad =
    oneOf('botMode', BOT_MODES) ??
    oneOf('listMode', LIST_MODES) ??
    oneOf('sendMode', SEND_MODES) ??
    oneOf('saveMode', SAVE_MODES) ??
    oneOf('deleteMode', DELETE_MODES) ??
    oneOf('csrfMode', CSRF_MODES);
  if (bad) return res.status(400).json({ error: bad });
  if (
    body.sendDelayMs !== undefined &&
    !(Number.isInteger(body.sendDelayMs) && body.sendDelayMs >= 0 && body.sendDelayMs <= SEND_DELAY_MAX)
  ) {
    return res.status(400).json({ error: `\`sendDelayMs\` must be an integer from 0 to ${SEND_DELAY_MAX}` });
  }
  let target = null;
  if (body.mutate !== undefined) {
    const m = body.mutate;
    if (!m || typeof m !== 'object' || !MUTATE_ACTIONS.includes(m.action)) {
      return res
        .status(400)
        .json({ error: `\`mutate\` must be { id, action } with action one of: ${MUTATE_ACTIONS.join(', ')}` });
    }
    target = findAnnouncement(m.id);
    if (!target) return res.status(400).json({ error: `\`mutate.id\` matches no announcement: ${m.id}` });
    // A SENT row can be deleted since ANNOUNCE-API-5 (the `view`-mode 404 path); it still cannot be
    // edited, so `markSent` and `clearBody` stay DRAFT-only.
    if (m.action !== 'delete' && target.status !== 'DRAFT') {
      return res
        .status(400)
        .json({ error: `\`mutate ${m.action}\` needs a DRAFT; ${m.id} is ${target.status}` });
    }
  }

  // Everything is valid — apply it all.
  if (body.botMode !== undefined) botMode = body.botMode;
  if (body.listMode !== undefined) listMode = body.listMode;
  if (body.sendMode !== undefined) sendMode = body.sendMode;
  if (body.sendDelayMs !== undefined) sendDelayMs = body.sendDelayMs;
  if (body.saveMode !== undefined) saveMode = body.saveMode;
  if (body.deleteMode !== undefined) deleteMode = body.deleteMode;
  if (body.csrfMode !== undefined) csrfMode = body.csrfMode;
  if (target) {
    const action = body.mutate.action;
    if (action === 'delete') ANNOUNCEMENTS.splice(ANNOUNCEMENTS.indexOf(target), 1);
    else if (action === 'markSent') commitSent(target);
    else {
      target.body = '';
      target.updatedAt = new Date().toISOString();
    }
  }
  res.json({
    botMode,
    listMode,
    sendMode,
    sendDelayMs,
    saveMode,
    deleteMode,
    csrfMode,
    ...(target ? { mutated: target.id } : {}),
  });
});

/**
 * Force ข้อความตอบกลับด่วน into a state (ANNOUNCE-UI-6 D-7) — any subset of:
 *   · `listMode: ok|error|network` — every GET (`error` = the code-less session-store 503)
 *   · `createMode: ok|limit` — `limit` forces the coded 400 on POST even below 5 rows
 *   · `saveMode: ok|no-code|network` — POST, PATCH and DELETE, before anything is written
 *   · `csrfMode: ok|reject` — the canned writes only (the announcements have their own)
 *   · `delayMs` — an integer 0–10000, slept before EVERY canned route answers, GET included
 *   · `mutate: { id, action: 'delete' }` — ANOTHER admin deletes it, once, now (404 paths)
 *   · `fill: true` — append test rows until there are 5
 *
 * ⚠️ ALL-OR-NOTHING like `/__control/announcements`: an unknown key, a bad value or an empty body is
 * a 400 `{ error }` and changes NOTHING.
 */
const CANNED_CONTROL_KEYS = ['listMode', 'createMode', 'saveMode', 'csrfMode', 'delayMs', 'mutate', 'fill'];

app.post('/__control/canned-replies', (req, res) => {
  const body = req.body ?? {};
  const keys = Object.keys(body);
  const unknown = keys.filter((k) => !CANNED_CONTROL_KEYS.includes(k));
  if (unknown.length) {
    return res.status(400).json({ error: `unknown key(s): ${unknown.join(', ')}` });
  }
  if (!keys.length) {
    return res.status(400).json({ error: `give at least one of: ${CANNED_CONTROL_KEYS.join(', ')}` });
  }
  const oneOf = (key, allowed) =>
    body[key] !== undefined && !allowed.includes(body[key])
      ? `\`${key}\` must be one of: ${allowed.join(', ')}`
      : null;
  const bad =
    oneOf('listMode', CANNED_LIST_MODES) ??
    oneOf('createMode', CANNED_CREATE_MODES) ??
    oneOf('saveMode', CANNED_SAVE_MODES) ??
    oneOf('csrfMode', CSRF_MODES);
  if (bad) return res.status(400).json({ error: bad });
  if (
    body.delayMs !== undefined &&
    !(Number.isInteger(body.delayMs) && body.delayMs >= 0 && body.delayMs <= CANNED_DELAY_MAX)
  ) {
    return res.status(400).json({ error: `\`delayMs\` must be an integer from 0 to ${CANNED_DELAY_MAX}` });
  }
  if (body.fill !== undefined && body.fill !== true) {
    return res.status(400).json({ error: '`fill` must be true' });
  }
  let target = null;
  if (body.mutate !== undefined) {
    const m = body.mutate;
    if (!m || typeof m !== 'object' || m.action !== 'delete') {
      return res.status(400).json({ error: "`mutate` must be { id, action: 'delete' }" });
    }
    target = findCanned(m.id);
    if (!target) return res.status(400).json({ error: `\`mutate.id\` matches no canned reply: ${m.id}` });
  }

  // Everything is valid — apply it all.
  if (body.listMode !== undefined) cannedListMode = body.listMode;
  if (body.createMode !== undefined) cannedCreateMode = body.createMode;
  if (body.saveMode !== undefined) cannedSaveMode = body.saveMode;
  if (body.csrfMode !== undefined) cannedCsrfMode = body.csrfMode;
  if (body.delayMs !== undefined) cannedDelayMs = body.delayMs;
  if (target) CANNED.splice(CANNED.indexOf(target), 1);
  let filled = 0;
  if (body.fill) {
    while (CANNED.length < CANNED_MAX) {
      const k = CANNED.length + 1;
      const now = new Date().toISOString();
      CANNED.push({
        id: `cmfcan${String(nextCannedId++).padStart(3, '0')}x7k2q9w4e1r5t8y0`,
        title: `ข้อความทดสอบ ${k}`,
        text: `ข้อความทดสอบสำหรับตรวจขีดจำกัด ${k}`,
        sortOrder: nextSortOrder(),
        createdAt: now,
        updatedAt: now,
      });
      filled++;
    }
  }
  res.json({
    listMode: cannedListMode,
    createMode: cannedCreateMode,
    saveMode: cannedSaveMode,
    csrfMode: cannedCsrfMode,
    delayMs: cannedDelayMs,
    count: CANNED.length,
    ...(target ? { mutated: target.id } : {}),
    ...(body.fill ? { filled } : {}),
  });
});

/* ── system/integrations (INTEGRATIONS-API-1) ─────────────────────────────
 * Mirrors `easybook-service/src/system/integrations.controller.ts` + `dto/integrations.dto.ts`:
 *   GET  /system/integrations            — SUPER_ADMIN|ADMIN (VIEWER 403)
 *   PATCH /system/integrations/swagger   — SUPER_ADMIN only (ADMIN + VIEWER 403), CSRF first
 *   PATCH /system/integrations/line      — SUPER_ADMIN only, CSRF first
 *   POST /system/integrations/line/verify, /storage/probe — SUPER_ADMIN|ADMIN, CSRF first
 * The secret and token are write-only here too: the stub never stores them, only `configured`.
 * Failure modes via `POST /__control/integrations`. */

const INTEG_DEFAULTS = () => ({
  swagger: false,
  channelId: '2006123442',
  configured: true,
  lineMode: 'ok', // ok | not-configured | unavailable
  storageMode: 'ok', // ok | read-fail | write-fail | unconfigured
  dbMode: 'ok', // ok | degraded | error
  redisMode: 'up', // up | down
  used: 44,
});
let INTEG = INTEG_DEFAULTS();

const requireSuper = (req, res, next) => {
  if (role !== 'SUPER_ADMIN') {
    return res
      .status(403)
      .json({ statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' });
  }
  next();
};
const integCsrf = csrfCheck(() => 'ok');
const maskId = (id) => (id.length > 6 ? `${id.slice(0, 4)}••••${id.slice(-2)}` : id);
const BOT = { basicId: '@easybook_th', displayName: 'EasyBook Bot', pictureUrl: null, chatMode: 'bot' };
const lineOk = () => INTEG.configured && INTEG.lineMode === 'ok';
const quota = () => ({ total: 500, used: INTEG.used });
const badRequest = (res, message) =>
  res.status(400).json({ statusCode: 400, message, error: 'Bad Request' });

app.get('/api/v1/system/integrations', denyViewerRead, (_req, res) => {
  const storageConfigured = INTEG.storageMode !== 'unconfigured';
  res.json({
    swagger: { enabled: INTEG.swagger },
    line: {
      configured: INTEG.configured,
      channelId: INTEG.channelId ? maskId(INTEG.channelId) : null,
      botInfo: lineOk() ? BOT : null,
      quota: lineOk() ? quota() : null,
    },
    storage: {
      configured: storageConfigured,
      bucket: storageConfigured ? 'easybook-dev' : null,
      publicBaseUrl: storageConfigured ? 'https://pub-3f9a2c.r2.dev' : null,
    },
    infrastructure: {
      database: {
        status: INTEG.dbMode,
        latencyMs: INTEG.dbMode === 'ok' ? 2 : INTEG.dbMode === 'degraded' ? 340 : 2000,
      },
      redis: { status: INTEG.redisMode, latencyMs: INTEG.redisMode === 'up' ? 1 : 2000 },
    },
  });
});

app.patch('/api/v1/system/integrations/swagger', integCsrf, requireSuper, (req, res) => {
  const body = req.body ?? {};
  const errors = Object.keys(body)
    .filter((k) => k !== 'enabled')
    .map((k) => `property ${k} should not exist`);
  if (typeof body.enabled !== 'boolean') errors.push('enabled must be a boolean value');
  if (errors.length) return badRequest(res, errors);
  INTEG.swagger = body.enabled;
  res.json({ success: true, enabled: INTEG.swagger });
});

app.patch('/api/v1/system/integrations/line', integCsrf, requireSuper, (req, res) => {
  const body = req.body ?? {};
  const allowed = ['channelId', 'channelSecret', 'channelAccessToken'];
  const errors = Object.keys(body)
    .filter((k) => !allowed.includes(k))
    .map((k) => `property ${k} should not exist`);
  const { channelId, channelSecret, channelAccessToken } = body;
  if (channelId !== undefined && !(typeof channelId === 'string' && /^\d{10}$/.test(channelId)))
    errors.push('channelId must be exactly 10 digits');
  if (
    channelSecret !== undefined &&
    !(typeof channelSecret === 'string' && /^[0-9a-f]{32}$/i.test(channelSecret))
  )
    errors.push('channelSecret must be 32 hexadecimal characters');
  if (
    channelAccessToken !== undefined &&
    !(
      typeof channelAccessToken === 'string' &&
      channelAccessToken.length >= 40 &&
      channelAccessToken.length <= 1000 &&
      /^\S+$/.test(channelAccessToken)
    )
  )
    errors.push('channelAccessToken must be longer than or equal to 40 characters');
  if (errors.length) return badRequest(res, errors);
  if (channelId === undefined && channelSecret === undefined && channelAccessToken === undefined) {
    return res.status(400).json({
      statusCode: 400,
      message: 'ต้องระบุค่าที่ต้องการเปลี่ยนอย่างน้อยหนึ่งค่า',
      error: 'Bad Request',
      code: 'LINE_UPDATE_EMPTY',
    });
  }
  if (channelId !== undefined) INTEG.channelId = channelId;
  if (channelAccessToken !== undefined) {
    INTEG.configured = true;
    INTEG.lineMode = 'ok';
  }
  res.json({ success: true, maskedChannelId: INTEG.channelId ? maskId(INTEG.channelId) : null });
});

app.post('/api/v1/system/integrations/line/verify', integCsrf, denyViewerRead, (_req, res) => {
  if (!INTEG.configured || INTEG.lineMode === 'not-configured') {
    return res.status(503).json({
      statusCode: 503,
      message: 'ยังไม่ได้ตั้งค่า LINE หรือ Channel Access Token ไม่ถูกต้อง',
      error: 'Service Unavailable',
      code: 'LINE_NOT_CONFIGURED',
    });
  }
  if (INTEG.lineMode === 'unavailable') {
    return res.status(503).json({
      statusCode: 503,
      message: 'ติดต่อ LINE ไม่ได้ชั่วคราว ลองใหม่อีกครั้ง',
      error: 'Service Unavailable',
      code: 'LINE_UNAVAILABLE',
    });
  }
  INTEG.used = 40 + Math.floor(Math.random() * 20);
  res.json({ valid: true, botInfo: BOT, quota: quota() });
});

app.post('/api/v1/system/integrations/storage/probe', integCsrf, denyViewerRead, (_req, res) => {
  const m = INTEG.storageMode;
  if (m === 'unconfigured') return res.json({ ok: false, latencyMs: 0, read: false, write: false });
  const read = m !== 'read-fail';
  const write = m !== 'write-fail';
  res.json({ ok: read && write, latencyMs: 35 + Math.floor(Math.random() * 30), read, write });
});

app.post('/__control/integrations', (req, res) => {
  const b = req.body ?? {};
  const pick = (k, allowed) => {
    if (b[k] === undefined) return null;
    if (!allowed.includes(b[k])) return `${k} must be one of ${allowed.join('|')}`;
    INTEG[k] = b[k];
    return null;
  };
  const errors = [
    pick('lineMode', ['ok', 'not-configured', 'unavailable']),
    pick('storageMode', ['ok', 'read-fail', 'write-fail', 'unconfigured']),
    pick('dbMode', ['ok', 'degraded', 'error']),
    pick('redisMode', ['up', 'down']),
    pick('swagger', [true, false]),
    pick('configured', [true, false]),
  ].filter(Boolean);
  if (errors.length) return res.status(400).json({ errors });
  res.json({ ...INTEG });
});

app.post('/__control/reset', (_req, res) => {
  ROWS = seed();
  // The version is state too, so it comes back with the seed — otherwise a downgrade driven for
  // one check survives into the next one and quietly repaints an unrelated screen amber.
  systemVersion = { ...DEFAULT_SYSTEM_VERSION };
  // Same reasoning for the announcement modes: a `not-configured` forced for one check must not
  // still be failing the OA card in the next.
  ANNOUNCEMENTS = announcementSeed();
  botMode = 'ok';
  listMode = 'ok';
  sendMode = 'ok';
  sendDelayMs = 0;
  saveMode = 'ok';
  deleteMode = 'ok';
  csrfMode = 'ok';
  nextId = 100;
  // …and the canned replies: the four migration defaults and every canned mode.
  CANNED = cannedSeed();
  nextCannedId = 100;
  cannedListMode = 'ok';
  cannedCreateMode = 'ok';
  cannedSaveMode = 'ok';
  cannedCsrfMode = 'ok';
  cannedDelayMs = 0;
  // …and การเชื่อมต่อระบบ: Swagger back OFF, LINE / R2 / DB / Redis back to healthy.
  INTEG = INTEG_DEFAULTS();
  res.json({
    ok: true,
    rows: ROWS.length,
    version: systemVersion.version,
    announcements: ANNOUNCEMENTS.length,
    botMode,
    listMode,
    sendMode,
    sendDelayMs,
    saveMode,
    deleteMode,
    csrfMode,
    cannedReplies: CANNED.length,
  });
});
app.post('/__control/emit', (req, res) => {
  const { event, id, status } = req.body;
  const row = id ? ROWS.find((r) => r.id === id) : ROWS[0];
  if (row && status) row.status = status;
  const booking = row ?? ROWS[0];
  if (event === 'bookingRequest.created') {
    const fresh = { ...booking, id: `b${Date.now()}`, code: `BR-NEW-${Date.now() % 1000}`, status: 'PENDING' };
    ROWS.unshift(fresh);
    emit(event, { booking: fresh, actor: null });
  } else {
    emit(event, { booking, actor: { id: 'u2', name: 'เจ้าหน้าที่ท่านอื่น' } });
  }
  res.json({ ok: true });
});

/* ── socket, mirroring the real /admin namespace ───────────────────────── */

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN, credentials: true } });
const admin = io.of('/admin');

// 🔴 The real gateway refuses VIEWER at the handshake (`REALTIME_ERRORS.forbidden`).
admin.use((socket, next) => {
  if (role === 'VIEWER') return next(new Error('FORBIDDEN'));
  next();
});

function emit(event, payload) {
  admin.emit(event, payload);
}

server.listen(PORT, () =>
  console.log(
    `[stub] :${PORT} — role=${role}, ${ROWS.length} booking rows, ${ANNOUNCEMENTS.length} announcements, ${CANNED.length} canned replies, version=${systemVersion.version} (from package.json)`,
  ),
);
