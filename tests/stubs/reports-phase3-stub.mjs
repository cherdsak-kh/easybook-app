/**
 * QA stub for reporting Phase 3 (Hub 4 export, Hub 5 activity, Hub 6 error log), registered by
 * `stub-server.mjs` on :3301. Paired with `.env.stub`.
 *
 * ⚠️ IT MIRRORS `@Roles` DELIBERATELY (the stub header says why): Hub 4 and Hub 5 routes answer
 * SUPER_ADMIN and ADMIN only, Hub 6 routes SUPER_ADMIN only, everything else 403 with the real
 * `RolesGuard` body. ⚠️ AND IT MIRRORS THE DTO SHAPES of `easybook-service` (`dto/report-document.dto.ts`,
 * `dto/audit.dto.ts`, `src/incidents/dto/incident.dto.ts`), including the three separate Hub 5 / Hub 6
 * KPI routes that take dates and nothing else (a toolbar key there is a pipe 400, as in the real app).
 *
 * Every request to `/api/v1/reports/{export,activity,error-log}*` is LOGGED with the role it was
 * answered under, so "a denied role's page fired ZERO requests" is read from `GET /__control/p3/log`
 * rather than assumed. `DELETE /reports/error-log` checks the CSRF header like the real middleware.
 *
 * Controls (`POST /__control/p3`, body keys all optional):
 *   exportMode    ok | empty | error | forbidden | slow     (Hub 4 document route)
 *   activityMode  ok | empty | error | forbidden | slow     (Hub 5 list + kpis + actors)
 *   errlogMode    ok | empty | error | forbidden | slow     (Hub 6 list + kpis)
 *   detailMode    ok | missing | error                      (Hub 6 detail)
 *   ledgerRows    number of ledger rows (default 70, so the print test has two pages)
 *   addIncident   true: append a fresh ERROR incident "now" (a poll then sees a new row)
 *   reset         true: back to the seed
 * `GET /__control/p3/log` lists the logged requests; `DELETE /__control/p3/log` clears it.
 */

const SCHOOL = 'โรงเรียนเทศบาลท่าโขลง 1 สังกัดเทศบาลเมืองท่าโขลง จังหวัดปทุมธานี';
const DAY = 86_400_000;
const BKK = 7 * 3_600_000;
const FORBIDDEN = { statusCode: 403, message: 'Forbidden resource', error: 'Forbidden' };

/* ── Bangkok date helpers ───────────────────────────────────────────────── */
const pad = (n, w = 2) => String(n).padStart(w, '0');
const bkkDate = (t) => {
  const d = new Date(t + BKK);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const dayStartMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - BKK;
};
const dayOf = (iso) => Math.round((Date.UTC(...iso.split('-').map((x, i) => (i === 1 ? +x - 1 : +x))) ) / DAY);
const inclusiveDays = (a, b) => dayOf(b) - dayOf(a) + 1;
const addDays = (iso, n) => bkkDate(dayStartMs(iso) + n * DAY + 12 * 3_600_000);
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_M_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thShort = (iso) => `${+iso.slice(8, 10)} ${TH_M[+iso.slice(5, 7) - 1]} ${+iso.slice(0, 4) + 543}`;
const hhmm = (h) => `${pad(Math.floor(h))}.${pad(Math.round((h % 1) * 60))} น.`;

function termOf(iso) {
  const md = iso.slice(5);
  const y = +iso.slice(0, 4);
  if (md >= '05-16' && md <= '10-31') return { n: 1, be: y + 543 };
  if (md >= '11-01') return { n: 2, be: y + 543 };
  if (md <= '03-31') return { n: 2, be: y + 543 - 1 };
  return null;
}
const termRange = (t) => {
  const y = t.be - 543;
  return t.n === 1 ? { from: `${y}-05-16`, to: `${y}-10-31` } : { from: `${y}-11-01`, to: `${y + 1}-03-31` };
};

/* ── the shared pipe: unknown keys are a 400 (forbidNonWhitelisted) ─────── */
function unknownKeys(req, allowed) {
  const bad = Object.keys(req.query).filter((k) => !allowed.includes(k));
  return bad.length
    ? { statusCode: 400, message: bad.map((k) => `property ${k} should not exist`), error: 'Bad Request' }
    : null;
}
function coded(code, message) {
  return { statusCode: 400, error: 'Bad Request', message, code };
}
function rangeError(start, end) {
  if (!isIso(start) || !isIso(end)) return coded('REPORT_DATE_INVALID', 'startDate and endDate must be valid dates (YYYY-MM-DD).');
  if (end < start) return coded('REPORT_RANGE_INVERTED', 'endDate must not be before startDate.');
  if (inclusiveDays(start, end) > 366) return coded('REPORT_RANGE_TOO_WIDE', 'The range must not exceed 366 days.');
  return null;
}

export function registerReportsPhase3(app, { getRole, csrfToken }) {
  const state = {
    exportMode: 'ok',
    activityMode: 'ok',
    errlogMode: 'ok',
    detailMode: 'ok',
    ledgerRows: 70,
  };
  const log = [];

  const roleIn = (...roles) => (req, res, next) => {
    log.push({ at: new Date().toISOString(), role: getRole(), method: req.method, url: req.originalUrl });
    if (!roles.includes(getRole())) return res.status(403).json(FORBIDDEN);
    next();
  };
  const staff = roleIn('SUPER_ADMIN', 'ADMIN');
  const superOnly = roleIn('SUPER_ADMIN');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mode = (key) => async (req, res, next) => {
    const m = state[key];
    if (m === 'slow') await sleep(1500);
    if (m === 'error') return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    if (m === 'forbidden') return res.status(403).json(FORBIDDEN);
    next();
  };

  /* ═════════════════════════════ Hub 4 ═════════════════════════════════ */
  const VENUES = [
    { id: 'v1', name: 'หอประชุมวารณ', isDeleted: false, isOpen: true, type: 'หอประชุม', cap: 800 },
    { id: 'v2', name: 'ห้องประชุมไอยราพรต', isDeleted: false, isOpen: true, type: 'ห้องประชุม', cap: 60 },
    { id: 'v3', name: 'สนามฟุตซอลหลังอาคาร 4', isDeleted: false, isOpen: false, type: 'สนามกีฬา', cap: 120 },
    { id: 'v4', name: 'ห้องศิลปะเก่า', isDeleted: true, isOpen: false, type: 'ห้องเรียน', cap: 40 },
  ];
  const DEPTS = [
    { id: 1, name: 'ฝ่ายวิชาการ', isDeleted: false, reserved: false },
    { id: 2, name: 'ฝ่ายบริหารงานทั่วไป', isDeleted: false, reserved: false },
    { id: 3, name: 'กลุ่มสาระวิทยาศาสตร์', isDeleted: false, reserved: false },
    { id: 4, name: 'ฝ่ายกิจการนักเรียน', isDeleted: true, reserved: false },
    { id: 9, name: 'ไม่ระบุกลุ่ม/ฝ่าย (ระบบ)', isDeleted: false, reserved: true },
  ];

  app.get('/api/v1/reports/export/scope-options', staff, (_req, res) =>
    res.json({
      venues: VENUES.map(({ id, name, isDeleted, isOpen }) => ({ id, name, isDeleted, isOpen })),
      departments: DEPTS.filter((d) => !d.reserved || getRole() === 'SUPER_ADMIN').map(({ id, name, isDeleted }) => ({ id, name, isDeleted })),
    }),
  );

  const numCell = (value, text, numFmt) => ({ text, value, numFmt });
  const txt = (text) => ({ text, value: null, numFmt: null });
  const row = (...cells) => ({ cells });
  const col = (label, align) => ({ label, align });

  function ledgerRows(n, vId) {
    const rows = [];
    const STAT = ['อนุมัติแล้ว', 'ปฏิเสธ (เวลาชน)', 'ปฏิเสธ', 'ยกเลิก', 'ยกเลิกกระชั้นชิด', 'หมดอายุ', 'รอพิจารณา'];
    const PURPOSES = [
      'ประชุมผู้ปกครองประจำภาคเรียน',
      '=HYPERLINK("http://example.test","คลิก")',
      '<script>alert(1)</script> ซ้อมการแสดง',
      'ซ้อมการแสดงสำหรับงานกีฬาสีประจำปีและการประกวดนักเรียนดีเด่นระดับเทศบาล รวมถึงการแสดงของชมรมดนตรีและนาฏศิลป์ไทยทุกระดับชั้น',
      'อบรมครูเรื่องการใช้สื่อดิจิทัล',
    ];
    for (let i = 0; i < n; i++) {
      const v = VENUES[i % 3];
      if (vId && v.id !== vId) continue;
      rows.push(
        row(
          txt(String(rows.length + 1)),
          txt(`BR-2569${pad(9 - (i % 2))}${pad(1 + (i % 27))}-${pad(i + 1, 3)}`),
          txt(`${thShort(addDays('2026-09-01', i % 28))} เวลา ${hhmm(8.5 + (i % 4))} ถึง ${hhmm(10.5 + (i % 4))}${i % 7 === 0 ? ' (ทุกสัปดาห์ จำนวน 4 สัปดาห์)' : ''}`),
          txt(v.name),
          txt(DEPTS[i % 3].name),
          txt(PURPOSES[i % PURPOSES.length]),
          txt(STAT[i % STAT.length]),
        ),
      );
    }
    return rows;
  }

  function buildDoc(q, startDate, endDate) {
    const t = q.template;
    const isEmpty = state.exportMode === 'empty' || endDate < '2000-01-01';
    const venueName = q.venueId ? VENUES.find((v) => v.id === q.venueId)?.name : null;
    const deptName = q.departmentId ? DEPTS.find((d) => String(d.id) === String(q.departmentId))?.name : null;
    const term = q.period === 'TERM' ? termOf(startDate) : null;
    const period =
      q.period === 'TERM' && term
        ? `ประจำภาคเรียนที่ ${term.n} ปีการศึกษา ${term.be}`
        : q.period === 'MONTH'
          ? `ประจำเดือน${TH_M_LONG[+startDate.slice(5, 7) - 1]} พ.ศ. ${+startDate.slice(0, 4) + 543}`
          : `ระหว่างวันที่ ${thShort(startDate)} ถึงวันที่ ${thShort(endDate)}`;
    const kind = { SUMMARY: '(แบบ 1 สรุปภาพรวม)', LEDGER: '(แบบ 2 บัญชีคำขอจอง)', VENUES: '(แบบ 3 สถิติรายสถานที่)' }[t];
    const title = { SUMMARY: 'แบบสรุปรายงานสถิติการใช้สถานที่จัดกิจกรรม', LEDGER: 'บัญชีประวัติการขอใช้สถานที่จัดกิจกรรม', VENUES: 'รายงานการใช้สถานที่จัดกิจกรรมรายห้อง' }[t];

    let sections;
    if (t === 'SUMMARY') {
      sections = [
        {
          title: 'ตัวชี้วัดหลัก',
          columns: [col('ตัวชี้วัด', 'TEXT'), col('จำนวน', 'NUM'), col('ร้อยละและหมายเหตุ', 'TEXT')],
          rows: [
            row(txt('คำขอใช้สถานที่ทั้งหมด'), numCell(188, '188 รายการ', '#,##0" รายการ"'), txt('นับตามวันแรกที่ใช้สถานที่')),
            row(txt('อนุมัติ'), numCell(120, '120 รายการ', '#,##0" รายการ"'), txt('63.8%')),
            row(txt('ปฏิเสธ'), numCell(30, '30 รายการ', '#,##0" รายการ"'), txt('16.0% (เวลาชนกับการจองเดิม 12 รายการ)')),
            row(txt('ยกเลิก'), numCell(38, '38 รายการ', '#,##0" รายการ"'), txt('20.2%')),
            row(txt('ชั่วโมงการใช้สถานที่'), numCell(842, '842.0 ชั่วโมง', '#,##0.0" ชั่วโมง"'), txt('82 วันทำการ')),
            row(txt('อัตราการใช้สถานที่'), numCell(0.457, '45.7%', '0.0%'), txt('เทียบกับเวลาเปิดทำการ วันจันทร์ถึงวันศุกร์ เวลา 08.30 ถึง 16.30 น. จำนวน 3 สถานที่')),
            row(txt('การผิดวินัยการใช้งาน'), numCell(5, '5 ครั้ง', '#,##0" ครั้ง"'), txt('4.2% ของการจองที่อนุมัติ (ยกเลิกกระชั้นชิด 5 ครั้ง ไม่มาใช้สถานที่ - ระบบยังไม่บันทึกการเข้าใช้จริง)')),
            row(txt('ระยะเวลาพิจารณาคำขอเฉลี่ย'), numCell(6.4, '6.4 ชั่วโมง', '#,##0.0" ชั่วโมง"'), txt('91.2% พิจารณาภายใน 24 ชั่วโมง')),
          ],
          emptyText: 'ไม่มีรายการในช่วงเวลาและขอบเขตที่เลือก',
        },
        {
          title: 'สถิติการใช้สถานที่รายห้อง',
          columns: [col('ลำดับ', 'CENTER'), col('สถานที่', 'TEXT'), col('คำขอ', 'NUM'), col('ชั่วโมงที่ใช้', 'NUM'), col('อัตราการใช้', 'NUM')],
          rows: VENUES.slice(0, 3).map((v, i) => row(txt(String(i + 1)), txt(v.name), numCell(60 - i * 11, String(60 - i * 11), '#,##0'), numCell(310 - i * 70, `${310 - i * 70}.0`, '#,##0.0'), numCell(0.6 - i * 0.12, `${(60 - i * 12).toFixed(1)}%`, '0.0%'))),
          emptyText: 'ไม่มีรายการในช่วงเวลาและขอบเขตที่เลือก',
        },
        {
          title: 'การจัดสรรสถานที่ตามกลุ่มสาระ/ฝ่ายงาน',
          columns: [col('ลำดับ', 'CENTER'), col('กลุ่มสาระ/ฝ่ายงาน', 'TEXT'), col('คำขอ', 'NUM'), col('ชั่วโมงที่ใช้', 'NUM'), col('สัดส่วน', 'NUM'), col('อัตราอนุมัติ', 'NUM')],
          rows: DEPTS.filter((d) => !d.reserved).map((d, i) => row(txt(String(i + 1)), txt(d.name + (d.isDeleted ? ' (ลบแล้ว)' : '')), numCell(50 - i * 9, String(50 - i * 9), '#,##0'), numCell(260 - i * 50, `${260 - i * 50}.0`, '#,##0.0'), numCell(0.3 - i * 0.05, `${(30 - i * 5).toFixed(1)}%`, '0.0%'), numCell(0.72, '72%', '0%'))),
          emptyText: 'ไม่มีรายการในช่วงเวลาและขอบเขตที่เลือก',
        },
      ];
    } else if (t === 'LEDGER') {
      sections = [
        {
          title: 'บัญชีคำขอใช้สถานที่ เรียงตามวันที่ใช้',
          columns: [col('ลำดับ', 'CENTER'), col('รหัสคำขอ', 'MONO'), col('วันที่ใช้', 'TEXT'), col('สถานที่', 'TEXT'), col('กลุ่ม/ฝ่ายผู้ขอ', 'TEXT'), col('วัตถุประสงค์', 'TEXT'), col('สถานะ', 'NOWRAP')],
          rows: ledgerRows(state.ledgerRows, q.venueId),
          emptyText: 'ไม่มีรายการในช่วงเวลาและขอบเขตที่เลือก',
        },
      ];
    } else {
      sections = [
        {
          title: 'การใช้สถานที่รายห้อง',
          columns: [col('ลำดับ', 'CENTER'), col('สถานที่', 'TEXT'), col('ประเภทและความจุ', 'TEXT'), col('ชั่วโมงที่ใช้', 'NUM'), col('อัตราการใช้', 'NUM'), col('อนุมัติ', 'NUM'), col('ชนเวลา', 'NUM'), col('ช่วงที่ใช้มากที่สุด', 'NOWRAP'), col('ผู้ใช้หลัก', 'TEXT')],
          rows: VENUES.filter((v) => !q.venueId || v.id === q.venueId).map((v, i) =>
            row(txt(String(i + 1)), txt(v.name + (v.isDeleted ? ' (ลบแล้ว)' : !v.isOpen ? ' (ปิดให้จอง)' : '')), txt(`${v.type} ความจุ ${v.cap.toLocaleString('en-US')} คน`), numCell(310 - i * 70, `${310 - i * 70}.0`, '#,##0.0'), numCell(0.6 - i * 0.1, `${(60 - i * 10).toFixed(1)}%`, '0.0%'), numCell(40 - i * 8, String(40 - i * 8), '#,##0'), numCell(i, String(i), '#,##0'), txt('วันพุธ เวลา 09.30 น.'), txt(`${DEPTS[i % 3].name} (${48 - i * 9}%)`)),
          ),
          emptyText: 'ไม่มีรายการในช่วงเวลาและขอบเขตที่เลือก',
        },
      ];
    }
    if (isEmpty) sections = sections.map((s) => ({ ...s, rows: [] }));

    const today = bkkDate(Date.now());
    const dataUntil = addDays(today, -1);
    const effectiveEnd = endDate < dataUntil ? endDate : dataUntil;
    const schoolDays = (() => {
      if (startDate > dataUntil) return 0;
      let n = 0;
      for (let d = startDate; d <= effectiveEnd; d = addDays(d, 1)) {
        const dow = new Date(dayStartMs(d) + BKK + 12 * 3_600_000).getUTCDay();
        if (dow >= 1 && dow <= 5 && !(d.slice(5) >= '04-01' && d.slice(5) <= '05-15')) n++;
      }
      return n;
    })();

    return {
      serverTime: new Date().toISOString(),
      range: {
        startDate,
        endDate,
        dataUntilDate: dataUntil,
        effectiveEndDate: startDate > dataUntil ? null : effectiveEnd,
        days: inclusiveDays(startDate, endDate),
        schoolDays,
        dataStartDate: '2025-06-02',
      },
      template: t,
      period: q.period,
      isEmpty,
      header: {
        title,
        school: SCHOOL,
        period,
        kind,
        dateRange: `ข้อมูลระหว่างวันที่ ${thShort(startDate)} ถึงวันที่ ${thShort(endDate)}`,
        scope: `สำหรับขอบเขตข้อมูล${venueName ? `สถานที่${venueName}` : 'สถานที่ทั้งหมด'} และ${deptName ?? 'กลุ่มสาระและฝ่ายงานทั้งหมด'}`,
      },
      sections,
      footer: `ข้อมูล ณ วันที่ ${thShort(today)} เอกสารออกโดยระบบ EasyBook`,
      fileName: `easybook-report-${t.toLowerCase()}_${startDate}_${endDate}.xlsx`,
    };
  }

  function exportQuery(req) {
    const bad = unknownKeys(req, ['template', 'period', 'startDate', 'endDate', 'venueId', 'departmentId']);
    if (bad) return bad;
    const { template, period, startDate, endDate, venueId, departmentId } = req.query;
    if (!['SUMMARY', 'LEDGER', 'VENUES'].includes(template) || !['TERM', 'MONTH', 'CUSTOM'].includes(period) || !startDate || !endDate) {
      return { statusCode: 400, message: ['template/period/startDate/endDate are required'], error: 'Bad Request' };
    }
    const r = rangeError(startDate, endDate);
    if (r) return r;
    if (period === 'TERM') {
      const t = termOf(startDate);
      const tr = t && termRange(t);
      if (!tr || tr.from !== startDate || tr.to !== endDate) return coded('REPORT_PERIOD_MISMATCH', 'startDate and endDate must be the exact bounds of the selected term or month.');
    }
    if (period === 'MONTH') {
      const [y, m] = startDate.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (startDate.slice(8) !== '01' || endDate !== `${y}-${pad(m)}-${pad(last)}`) return coded('REPORT_PERIOD_MISMATCH', 'startDate and endDate must be the exact bounds of the selected term or month.');
    }
    if (venueId && !VENUES.some((v) => v.id === venueId)) return coded('REPORT_VENUE_INVALID', 'Unknown venueId.');
    if (departmentId) {
      const d = DEPTS.find((x) => String(x.id) === String(departmentId));
      if (!d || (d.reserved && getRole() !== 'SUPER_ADMIN')) return coded('REPORT_DEPARTMENT_INVALID', 'Unknown departmentId.');
    }
    return null;
  }

  app.get('/api/v1/reports/export', staff, mode('exportMode'), (req, res) => {
    const err = exportQuery(req);
    if (err) return res.status(400).json(err);
    res.json(buildDoc(req.query, req.query.startDate, req.query.endDate));
  });
  app.get('/api/v1/reports/export/xlsx', staff, (req, res) => {
    const err = exportQuery(req);
    if (err) return res.status(400).json(err);
    const name = `easybook-report-${req.query.template.toLowerCase()}_${req.query.startDate}_${req.query.endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from('PK\u0003\u0004 stub workbook, not a real xlsx'));
  });

  /* ═════════════════════════════ Hub 5 ═════════════════════════════════ */
  const ACTORS = [
    { id: 'u2', name: 'เชิดศักดิ์ คำไล้', role: 'SUPER_ADMIN', position: 'ผู้ดูแลระบบ', department: 'ฝ่ายเทคโนโลยีสารสนเทศ', state: 'ACTIVE' },
    { id: 'u4', name: 'สมหญิง เรืองศรี', role: 'ADMIN', position: 'เจ้าหน้าที่', department: 'ฝ่ายบริหารงานทั่วไป', state: 'ACTIVE' },
    { id: 'u13', name: 'ธนกร แสงจันทร์', role: 'ADMIN', position: 'เจ้าหน้าที่', department: 'ฝ่ายอาคารสถานที่', state: 'ACTIVE' },
    { id: 'u9', name: 'อารีย์ สุขใจ', role: 'ADMIN', position: 'เจ้าหน้าที่', department: null, state: 'SOFT_DELETED' },
  ];
  const ACTION_LABEL = { APPROVE: 'อนุมัติ', REJECT: 'ปฏิเสธ', CANCEL: 'ยกเลิก', DIRECT_BOOKING: 'จองแทน', ACCOUNT: 'บัญชี', BROADCAST: 'ประกาศ' };

  function seedEvents() {
    const out = [];
    const now = Date.now();
    const mk = (i, action, daysAgo, hh, mm, ss, actorIx) => {
      const at = new Date(dayStartMs(addDays(bkkDate(now), -daysAgo)) + ((hh * 60 + mm) * 60 + ss) * 1000).toISOString();
      const code = `BR-2569${pad(9 - (i % 2))}${pad(1 + (i % 27))}-${pad(i + 1, 3)}`;
      const a = actorIx === null ? null : ACTORS[actorIx];
      const isBooking = ['APPROVE', 'REJECT', 'CANCEL', 'DIRECT_BOOKING'].includes(action);
      out.push({
        id: `${{ APPROVE: 'APV', REJECT: 'REJ', CANCEL: 'CAN', DIRECT_BOOKING: 'DIR', ACCOUNT: 'ACC', BROADCAST: 'ANN' }[action]}-${isBooking ? code : `x${i}`}`,
        at,
        atIsApproximate: action === 'REJECT',
        action,
        actor: a ? { id: a.id, name: a.name, role: a.role, position: a.position, department: a.department, state: a.state } : null,
        target: isBooking
          ? { kind: 'BOOKING_REQUEST', id: `br${i}`, label: code, detail: `${VENUES[i % 3].name} · ${DEPTS[i % 3].name}`, isDeleted: false }
          : action === 'ACCOUNT'
            ? { kind: 'STAFF_ACCOUNT', id: `su${i}`, label: 'ศิริพร ทองใบ', detail: 'เจ้าหน้าที่ · ฝ่ายกิจการนักเรียน', isDeleted: false }
            : { kind: 'ANNOUNCEMENT', id: `an${i}`, label: 'ปิดปรับปรุงหอประชุมใหญ่ 1–3 ต.ค. 2569', detail: 'ผู้รับ ทุกคน', isDeleted: false },
        summary: isBooking
          ? `${{ APPROVE: 'อนุมัติการใช้', REJECT: 'ปฏิเสธคำขอใช้', CANCEL: 'ยกเลิกการจอง', DIRECT_BOOKING: 'จองแทนฝ่ายวิชาการ ที่' }[action]}${VENUES[i % 3].name} วันที่ ${thShort(addDays(bkkDate(now), 3))}`
          : action === 'ACCOUNT'
            ? 'สร้างบัญชีเจ้าหน้าที่ใหม่'
            : 'ส่งประกาศถึงผู้ใช้ 1,248 คน',
        changes: action === 'ACCOUNT' ? null : [{ field: 'สถานะคำขอ', before: action === 'DIRECT_BOOKING' ? '-' : 'รอพิจารณา', after: { APPROVE: 'อนุมัติแล้ว', REJECT: 'ปฏิเสธ', CANCEL: 'ยกเลิก', DIRECT_BOOKING: 'อนุมัติแล้ว', BROADCAST: 'ส่งแล้ว' }[action] }, ...(action === 'BROADCAST' ? [{ field: 'จำนวนผู้รับ', before: '-', after: '1,248 คน' }] : [])],
        note: action === 'REJECT' ? 'ช่วงเวลาดังกล่าวตรงกับการสอบกลางภาค' : action === 'CANCEL' ? 'ผู้ขอแจ้งยกเลิกทางโทรศัพท์' : null,
        ip: null,
        userAgent: null,
      });
    };
    // 25 events at the IDENTICAL timestamp (page-stability fixture), the rest spread over 40 days.
    for (let i = 0; i < 25; i++) mk(i, ['APPROVE', 'APPROVE', 'REJECT', 'CANCEL', 'DIRECT_BOOKING'][i % 5], 1, 10, 15, 42, i % 5 === 2 ? null : i % 4);
    mk(100, 'ACCOUNT', 2, 9, 10, 0, 0);
    mk(101, 'BROADCAST', 3, 14, 5, 0, null);
    mk(102, 'APPROVE', 3, 8, 12, 7, 1);
    mk(103, 'REJECT', 5, 15, 40, 0, null);
    mk(104, 'CANCEL', 8, 13, 20, 0, 2);
    mk(105, 'APPROVE', 14, 11, 0, 0, 3);
    mk(106, 'ACCOUNT', 20, 9, 30, 0, 0);
    mk(107, 'APPROVE', 27, 10, 5, 0, 1);
    mk(108, 'DIRECT_BOOKING', 33, 10, 20, 0, 1);
    mk(109, 'APPROVE', 40, 11, 0, 0, 2);
    out.sort((x, y) => (x.at === y.at ? (x.id < y.id ? 1 : -1) : x.at < y.at ? 1 : -1));
    return out;
  }
  const EVENTS = seedEvents();

  const inRangeEvents = (s, e) => EVENTS.filter((ev) => bkkDate(Date.parse(ev.at)) >= s && bkkDate(Date.parse(ev.at)) <= e);
  const norm = (x) => String(x ?? '').normalize('NFC').toLocaleLowerCase('th');
  const hay = (ev) => norm([ev.id, ev.target.label, ev.target.detail, ev.summary, ev.note, ev.actor?.name, ev.actor?.department, ACTION_LABEL[ev.action]].join(' '));

  const activityRange = (req, res, allowed) => {
    const bad = unknownKeys(req, allowed);
    if (bad) return res.status(400).json(bad);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ statusCode: 400, message: ['startDate and endDate are required'], error: 'Bad Request' });
    const r = rangeError(startDate, endDate);
    if (r) return res.status(400).json(r);
    return null;
  };
  const rangeDto = (s, e) => ({ startDate: s, endDate: e, days: inclusiveDays(s, e) });

  app.get('/api/v1/reports/activity', staff, mode('activityMode'), (req, res) => {
    if (activityRange(req, res, ['startDate', 'endDate', 'action', 'actorId', 'q', 'page', 'limit'])) return;
    const { startDate, endDate, action, actorId, q } = req.query;
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (![10, 20, 50].includes(limit)) return res.status(400).json({ statusCode: 400, message: ['limit must be one of 10, 20, 50'], error: 'Bad Request' });
    let rows = state.activityMode === 'empty' ? [] : inRangeEvents(startDate, endDate);
    if (action) rows = rows.filter((e) => e.action === action);
    if (actorId) rows = rows.filter((e) => e.actor?.id === actorId);
    if (q && q.trim()) rows = rows.filter((e) => hay(e).includes(norm(q.trim())));
    const totalPages = Math.max(1, Math.ceil(rows.length / limit));
    const page = Math.min(Math.max(1, Number(req.query.page ?? 1) || 1), totalPages);
    res.json({
      serverTime: new Date().toISOString(),
      range: rangeDto(startDate, endDate),
      capabilities: { source: 'SYNTHESIZED', actions: ['APPROVE', 'REJECT', 'CANCEL', 'DIRECT_BOOKING', 'ACCOUNT', 'BROADCAST'], recordsIp: false, recordsResourceChanges: false },
      items: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: rows.length,
      totalPages,
    });
  });
  app.get('/api/v1/reports/activity/kpis', staff, mode('activityMode'), (req, res) => {
    if (activityRange(req, res, ['startDate', 'endDate'])) return;
    const { startDate, endDate } = req.query;
    const rows = state.activityMode === 'empty' ? [] : inRangeEvents(startDate, endDate);
    const c = (a) => rows.filter((e) => e.action === a).length;
    const by = new Map();
    for (const e of rows) if (e.actor?.name) by.set(e.actor.id, (by.get(e.actor.id) ?? 0) + 1);
    const top = [...by.entries()].sort((a, b) => b[1] - a[1] || ACTORS.find((x) => x.id === a[0]).name.localeCompare(ACTORS.find((x) => x.id === b[0]).name, 'th'))[0];
    res.json({
      serverTime: new Date().toISOString(),
      range: rangeDto(startDate, endDate),
      kpis: {
        total: rows.length,
        days: inclusiveDays(startDate, endDate),
        approve: c('APPROVE'),
        reject: c('REJECT'),
        cancel: c('CANCEL'),
        directBooking: c('DIRECT_BOOKING'),
        resourceChanges: null,
        topActor: top ? { actor: { ...ACTORS.find((x) => x.id === top[0]) }, count: top[1], percent: (100 * top[1]) / rows.length } : null,
      },
    });
  });
  app.get('/api/v1/reports/activity/actors', staff, mode('activityMode'), (req, res) => {
    if (activityRange(req, res, ['startDate', 'endDate'])) return;
    const { startDate, endDate } = req.query;
    const ids = new Set(inRangeEvents(startDate, endDate).filter((e) => e.actor?.name).map((e) => e.actor.id));
    res.json({
      serverTime: new Date().toISOString(),
      range: rangeDto(startDate, endDate),
      actors: ACTORS.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name, 'th')).map((a) => ({ id: a.id, name: a.name, isDeleted: a.state !== 'ACTIVE' })),
    });
  });
  app.get('/api/v1/reports/activity/csv', staff, (req, res) => {
    if (activityRange(req, res, ['startDate', 'endDate', 'action', 'actorId', 'q'])) return;
    const { startDate, endDate } = req.query;
    const rows = inRangeEvents(startDate, endDate);
    const cell = (v) => (/[",\r\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const lines = ['ประวัติการทำรายการ', `ช่วงข้อมูล ${thShort(startDate)} ถึง ${thShort(endDate)}`, '', ['รหัสเหตุการณ์', 'วันที่', 'เวลา', 'เจ้าหน้าที่ผู้กระทำ', 'การกระทำ', 'สรุปการเปลี่ยนแปลง'].join(',')];
    for (const e of rows) lines.push([e.id, bkkDate(Date.parse(e.at)), e.at, e.actor?.name ?? 'ไม่ได้บันทึกผู้กระทำ', ACTION_LABEL[e.action], e.summary].map(cell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="easybook-audit_${startDate}_${endDate}.csv"`);
    res.send('﻿' + lines.join('\r\n') + '\r\n');
  });

  /* ═════════════════════════════ Hub 6 ═════════════════════════════════ */
  const SIGS = [
    { component: 'LINE_OA', severity: 'ERROR', status: 504, method: 'POST', path: '/api/v1/line/webhook', message: 'LINE Messaging API Gateway Timeout: connection reset by peer' },
    { component: 'PRISMA_DB', severity: 'CRITICAL', status: 500, method: 'POST', path: '/api/v1/booking-requests/br42/approve', message: 'P2034: Transaction failed due to a write conflict or a deadlock. Please retry your transaction' },
    { component: 'CLOUDFLARE_R2', severity: 'ERROR', status: 503, method: 'PUT', path: '/api/v1/venues/v1/photos', message: 'Cloudflare R2 Storage Service Unavailable: socket hang up' },
    { component: 'CLOUDFLARE_R2', severity: 'WARNING', status: 200, method: 'PUT', path: '/api/v1/venues/v1/photos', message: 'R2 upload retried 2 times (ECONNRESET), succeeded after 6.4 s' },
    { component: 'REDIS', severity: 'ERROR', status: 500, method: 'GET', path: '/api/v1/venues/schedule', message: 'RedisCommandTimeoutError: Command timed out after 2000ms at 127.0.0.1:6379' },
    { component: 'API', severity: 'ERROR', status: 500, method: 'GET', path: '/api/v1/reports/overview', message: "TypeError: Cannot read properties of undefined (reading 'map') " + 'x'.repeat(220) },
    { component: 'LINE_OA', severity: 'WARNING', status: null, method: null, path: null, message: 'LINE push slow response: 4812 ms (threshold 3000 ms), delivered after 1 retry' },
  ];
  const CALLERS = [
    { kind: 'STAFF', label: 'staff:cm1abc (ADMIN)' },
    { kind: 'LINE_USER', label: 'line-user:U4af49…c2e1' },
    { kind: 'LINE_PLATFORM', label: 'LINE Platform (webhook)' },
    { kind: 'SYSTEM', label: 'system (LINE OA push)' },
    { kind: 'ANONYMOUS', label: 'anonymous' },
  ];
  let seq = 0;
  let INCIDENTS = [];
  function incident(sig, atMs, callerIx) {
    seq += 1;
    const s = SIGS[sig % SIGS.length];
    const id = `ERR-${s.status ?? 'SYS'}-${pad(seq, 4)}`;
    return {
      id,
      traceId: `tr-${(0x9e3779b1 * seq >>> 0).toString(16).padStart(8, '0')}${(0x85ebca6b * seq >>> 0).toString(16).padStart(8, '0')}`,
      at: new Date(atMs).toISOString(),
      severity: s.severity,
      component: s.component,
      status: s.status,
      method: s.method,
      path: s.path,
      routeTemplate: s.path ? s.path.replace(/\/(br|v)\d+/g, '/:id') : null,
      message: s.message,
      caller: CALLERS[callerIx % CALLERS.length],
      ip: callerIx % 5 === 3 ? null : `10.20.${callerIx % 9}.${10 + callerIx}`,
    };
  }
  function seedIncidents() {
    seq = 0;
    const now = Date.now();
    const list = [];
    // 3 inside the last 24 h, then spread over 60 days (the tail is older than the 30-day window).
    [0.5, 3, 20].forEach((h, i) => list.push(incident(i + 1, now - h * 3_600_000, i)));
    for (let i = 0; i < 52; i++) list.push(incident(i, now - (1.2 + i * 1.15) * DAY, i));
    return list.sort((a, b) => (a.at < b.at ? 1 : -1));
  }
  INCIDENTS = seedIncidents();

  const cutoff = () => addDays(bkkDate(Date.now()), -29);
  const incRange = (req, res, allowed) => {
    const bad = unknownKeys(req, allowed);
    if (bad) return res.status(400).json(bad);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ statusCode: 400, message: ['startDate and endDate are required'], error: 'Bad Request' });
    const r = rangeError(startDate, endDate);
    if (r) return res.status(400).json(r);
    return null;
  };
  const incNorm = (i) => norm([i.id, i.traceId, `${i.status ?? ''} ${i.method ?? ''} ${i.path ?? ''}`, i.message, { LINE_OA: 'LINE OA', PRISMA_DB: 'Prisma / DB', CLOUDFLARE_R2: 'Cloudflare R2', REDIS: 'Redis', AUTH: 'Auth', API: 'API' }[i.component]].join(' '));
  const incIn = (s, e) => (state.errlogMode === 'empty' ? [] : INCIDENTS.filter((i) => bkkDate(Date.parse(i.at)) >= s && bkkDate(Date.parse(i.at)) <= e));

  app.get('/api/v1/reports/error-log', superOnly, mode('errlogMode'), (req, res) => {
    if (incRange(req, res, ['startDate', 'endDate', 'severity', 'component', 'q', 'page', 'limit'])) return;
    const { startDate, endDate, severity, component, q } = req.query;
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (![10, 20, 50].includes(limit)) return res.status(400).json({ statusCode: 400, message: ['limit must be one of 10, 20, 50'], error: 'Bad Request' });
    let rows = incIn(startDate, endDate);
    if (severity) rows = rows.filter((i) => i.severity === severity);
    if (component) rows = rows.filter((i) => i.component === component);
    if (q && q.trim()) rows = rows.filter((i) => incNorm(i).includes(norm(q.trim())));
    const totalPages = Math.max(1, Math.ceil(rows.length / limit));
    const page = Math.min(Math.max(1, Number(req.query.page ?? 1) || 1), totalPages);
    const c = cutoff();
    res.json({
      serverTime: new Date().toISOString(),
      range: rangeDto(startDate, endDate),
      retention: { maxEntries: 5000, maxDays: 90 },
      purgeable: { count: INCIDENTS.filter((i) => bkkDate(Date.parse(i.at)) < c).length, cutoffDate: c },
      items: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: rows.length,
      totalPages,
    });
  });
  app.get('/api/v1/reports/error-log/kpis', superOnly, mode('errlogMode'), (req, res) => {
    if (incRange(req, res, ['startDate', 'endDate'])) return;
    const { startDate, endDate } = req.query;
    const rows = incIn(startDate, endDate);
    const days = inclusiveDays(startDate, endDate);
    const failed = rows.filter((i) => (i.status ?? 0) >= 500).length;
    const requests = days * 1850;
    const crit = rows.filter((i) => i.severity === 'CRITICAL');
    const ext = (c) => rows.filter((i) => i.component === c).length;
    res.json({
      serverTime: new Date().toISOString(),
      range: rangeDto(startDate, endDate),
      kpis: {
        availability: { percent: 100 * (1 - failed / requests), failed, requests, daysWithoutData: 0, targetPercent: 99.5 },
        last24h: INCIDENTS.filter((i) => Date.parse(i.at) >= Date.now() - DAY).length,
        inRange: rows.length,
        critical: { count: crit.length, latestAt: crit[0]?.at ?? null },
        external: { lineOa: ext('LINE_OA'), cloudflareR2: ext('CLOUDFLARE_R2'), redis: ext('REDIS') },
      },
    });
  });
  app.get('/api/v1/reports/error-log/csv', superOnly, (req, res) => {
    if (incRange(req, res, ['startDate', 'endDate', 'severity', 'component', 'q'])) return;
    const { startDate, endDate } = req.query;
    const cell = (v) => (/[",\r\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
    const lines = ['บันทึกข้อผิดพลาด', `ช่วงข้อมูล ${thShort(startDate)} ถึง ${thShort(endDate)}`, '', ['รหัสเหตุการณ์', 'ความรุนแรง', 'ข้อความ', 'Trace ID'].join(',')];
    for (const i of incIn(startDate, endDate)) lines.push([i.id, i.severity, i.message, i.traceId].map(cell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="easybook-error-log_${startDate}_${endDate}.csv"`);
    res.send('﻿' + lines.join('\r\n') + '\r\n');
  });
  app.get('/api/v1/reports/error-log/detail/:id', superOnly, (req, res) => {
    if (state.detailMode === 'error') return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    const i = INCIDENTS.find((x) => x.id === req.params.id);
    if (!i || state.detailMode === 'missing') {
      return res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'Incident not found or no longer retained.', code: 'INCIDENT_NOT_FOUND' });
    }
    res.json({
      ...i,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/14.12.0',
      errorCode: i.component === 'PRISMA_DB' ? 'P2034' : null,
      queryKeys: i.method === 'GET' ? ['venueId', 'date'] : [],
      stack: [
        `${i.message.split(':')[0]}: ${i.message}`,
        '    at LineMessagingClient.replyMessage (/app/dist/line/line-messaging.client.js:74:19)',
        '    at async LineWebhookService.handleEvent (/app/dist/line/line-webhook.service.js:58:13)',
        '    at async LineWebhookController.receive (/app/dist/line/line-webhook.controller.js:41:9)',
        '    at async someVeryLongFunctionNameThatKeepsGoing (/app/dist/' + 'very/long/path/'.repeat(12) + 'file.js:1:1)',
        'Caused by: Error: read ECONNRESET',
        '    at TLSWrap.onStreamRead (node:internal/stream_base_commons:218:20)',
      ].join('\n'),
      context: { operation: 'replyMessage', attempt: 2, attempts: 3, latencyMs: 6412, budgetMs: 3000, params: i.path?.includes('/br') ? { id: 'br42' } : {} },
    });
  });
  app.delete('/api/v1/reports/error-log', (req, res) => {
    log.push({ at: new Date().toISOString(), role: getRole(), method: req.method, url: req.originalUrl, csrf: req.get('x-csrf-token') ?? null });
    if (req.get('x-csrf-token') !== csrfToken) return res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token.', error: 'Forbidden' });
    if (getRole() !== 'SUPER_ADMIN') return res.status(403).json(FORBIDDEN);
    if (state.errlogMode === 'error') return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    const c = cutoff();
    INCIDENTS = INCIDENTS.filter((i) => bkkDate(Date.parse(i.at)) >= c);
    res.status(204).end();
  });

  /* ═════════════════════════════ control ═══════════════════════════════ */
  app.post('/__control/p3', (req, res) => {
    const b = req.body ?? {};
    if (b.reset) {
      state.exportMode = 'ok';
      state.activityMode = 'ok';
      state.errlogMode = 'ok';
      state.detailMode = 'ok';
      state.ledgerRows = 70;
      INCIDENTS = seedIncidents();
    }
    for (const k of ['exportMode', 'activityMode', 'errlogMode', 'detailMode']) if (typeof b[k] === 'string') state[k] = b[k];
    if (Number.isInteger(b.ledgerRows)) state.ledgerRows = b.ledgerRows;
    if (b.addIncident) INCIDENTS.unshift(incident(5, Date.now(), 0));
    res.json({ ...state, incidents: INCIDENTS.length });
  });
  app.get('/__control/p3/log', (_req, res) => res.json(log));
  app.delete('/__control/p3/log', (_req, res) => {
    log.length = 0;
    res.status(204).end();
  });
}
