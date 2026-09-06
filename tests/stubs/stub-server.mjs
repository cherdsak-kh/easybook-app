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
 *   - booking-requests (list/detail/approve/reject/cancel/preflight/direct) — as before
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
 *   POST /__control/role      { role }                     — switch the signed-in role
 *   POST /__control/emit      { event, id, status, actor } — push a realtime event
 *   POST /__control/reset                                   — restore the seed
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
 * Worked `curl` examples for the three control routes:
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
 *   # Restore the original seed
 *   curl -s -X POST http://localhost:3301/__control/reset \
 *     -H "Content-Type: application/json" -d '{}'
 */
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';

const PORT = 3301;
const ORIGIN = ['http://localhost:2201', 'http://localhost:2200'];

const app = express();
app.use(express.json());
app.use(cors({ origin: ORIGIN, credentials: true }));

/* ── vocabularies (option tables) ─────────────────────────────────────────
 * Shapes mirror `DepartmentResponseDto` / `PersonnelRoleResponseDto` (holderCount = staffCount +
 * registrationCount, two populations) and `VenueTypeResponseDto` / `AmenityResponseDto` (one
 * population, `holderCount` only). `isFallback` is always false here — this stub does not model a
 * tombstone row.
 */

const OPTION_STAMP = { createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' };

const DEPARTMENTS = [
  { id: 1, name: 'ฝ่ายกิจการนักเรียน', isSystemReserved: false, staffCount: 4, registrationCount: 9 },
  { id: 2, name: 'กลุ่มสาระวิทยาศาสตร์', isSystemReserved: false, staffCount: 7, registrationCount: 6 },
].map((d) => ({ ...d, ...OPTION_STAMP, isFallback: false, holderCount: d.staffCount + d.registrationCount }));

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

app.get('/api/v1/auth/system/csrf', (_req, res) => res.json({ csrfToken: 'stub-csrf-token' }));

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

app.get('/api/v1/departments', denyViewerRead, (_req, res) => res.json(DEPARTMENTS));
app.get('/api/v1/personnel-roles', denyViewerRead, (_req, res) => res.json(PERSONNEL_ROLES));
app.get('/api/v1/venue-types', denyViewerRead, (_req, res) => res.json(VENUE_TYPES));
app.get('/api/v1/amenities', denyViewerRead, (_req, res) => res.json(AMENITIES));

app.get('/api/v1/system/version', (_req, res) =>
  res.json({ version: '0.4.0', build: 'stub0000', releasedAt: '2026-09-01T02:00:00.000Z' }),
);

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

/* ── control plane ─────────────────────────────────────────────────────── */

app.post('/__control/role', (req, res) => {
  role = req.body.role;
  res.json({ role });
});
app.post('/__control/reset', (_req, res) => {
  ROWS = seed();
  res.json({ ok: true, rows: ROWS.length });
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
  console.log(`[stub] :${PORT} — role=${role}, ${ROWS.length} booking rows`),
);
