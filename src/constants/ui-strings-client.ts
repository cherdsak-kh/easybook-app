/**
 * User-facing copy for the **client portal** — the LIFF surface end users see
 * inside the LINE app (`HomePage.tsx`, `RegistrationForm.tsx`) — in one place so
 * a component and its tests read the SAME string.
 *
 * ## Why two dictionaries rather than one
 * The two portals share no copy and no audience: the backend portal is internal
 * staff tooling, the client portal is what a member of the public reads in the
 * LINE webview. Keeping them apart means a Backend Portal re-word can never
 * reach an end user's screen, and this extraction picks its own grouping without
 * renegotiating the backend one. Do not import `ui-strings-backend.ts` from a
 * client component, or vice versa.
 *
 * ## What this is NOT
 * Not i18n — same as `ui-strings-backend.ts`. There is no locale, no framework
 * and no `t()` lookup; this is a plain `as const` object reached by property
 * access. Do not grow it into a locale system without a plan that asks for one.
 *
 * The copy below is **deliberately mixed Thai and English** — that is the
 * product's current state, not drift this file was extracted to "fix". Every
 * string was moved verbatim (same language, wording, punctuation and ellipsis
 * characters). Re-wording is a copy change, not a refactor; make it explicitly.
 *
 * ## Known trade-off (accepted, deliberate)
 * A test asserting `getByLabelText(UI_STRINGS_CLIENT.registration.firstName)`
 * against a component rendering that same constant can no longer catch WRONG
 * COPY — a typo here ships green. Copy correctness moves to code review; the
 * tests' value moves to the behavioural assertions (payload shape, `Number()`
 * id coercion, bearer-token use, the 403/409/400 error mapping, and the OBS-2
 * mock-mode gate). Do not let a refactor here hollow those out. Where a test's
 * ONLY point is that a specific literal renders — the OBS-2 auth-error message,
 * the "no 'student' wording" check — the literal stays hard-coded in the test as
 * a deliberate anchor (precedent: `routes.test.ts`).
 *
 * ## Scope
 * The **client portal** screens, grouped by surface, in flow order: splash →
 * LINE login → resolving → friendship gate → registration/edit → pending →
 * allowed → blocked → the two error screens.
 *
 * Not covered: the **Backend Portal** (`/backend/*`), whose copy lives in
 * `ui-strings-backend.ts`. Also deliberately excluded:
 *  - `StatusCard`'s `tone`/`icon` props — semantic identifiers, not copy.
 *  - Logo/QR asset paths — this is a copy store, not an asset registry.
 *  - `HomePage`'s `new ApiError(401, 'Missing LINE session.')` — a thrown
 *    diagnostic that `RegistrationForm` catches and replaces with
 *    {@link UI_STRINGS_CLIENT.registration.optionsError}; it never reaches a
 *    screen.
 *  - Backend-supplied `err.message` values (e.g. `STAFF_ID_TAKEN`) — server
 *    data rendered as-is, not our copy.
 *
 * It is a UI-label store: never import it into `api-client.ts` or any
 * non-presentational module.
 */
export const UI_STRINGS_CLIENT = {
  /**
   * Generic actions with no surface semantics. Kept deliberately small — screen
   * copy stays under its own surface even when the literal repeats, so
   * re-wording one screen never silently re-words another.
   */
  common: {
    /** Shared by the gate-error retry and the registration options retry: one
     *  generic "retry the thing that just failed" action, not two messages. */
    tryAgain: 'Try again',
  },

  // ---------------------------------------------------------------- Splash
  /** The animated full-screen splash shown while LIFF initialises / redirects. */
  splash: {
    /** The `status` region's accessible name — the only name the splash has. */
    loading: 'Loading EasyBook',
    /** Alt for the logo. Deliberately NOT shared with `lineLogin.logoAlt`,
     *  which happens to render the same word: two surfaces, two decisions. */
    logoAlt: 'EasyBook',
  },

  // -------------------------------------------------------------- Resolving
  /** The interstitial spinner while the friendship / status gates are in flight. */
  resolving: {
    loading: 'Loading your account…',
  },

  // ------------------------------------------------------------- LINE login
  /** The "Log in with LINE" card shown to signed-out web visitors. */
  lineLogin: {
    logoAlt: 'EasyBook',
    heading: 'ยินดีต้อนรับสู่ EasyBook',
    subheading: 'เข้าสู่ระบบด้วยบัญชี LINE ของคุณเพื่อใช้งานระบบ',
    submit: 'เข้าสู่ระบบด้วย LINE',
  },

  // ----------------------------------------------------------- Friendship gate
  /** Prompts the user to add the LINE Official Account before continuing. */
  addFriend: {
    heading: 'เพิ่มเพื่อน EasyBook บน LINE',
    intro:
      'เพื่อดำเนินการต่อ โปรดเพิ่มบัญชีทางการของเราเป็นเพื่อน โดยสแกนคิวอาร์โค้ดด้านล่างผ่านแอปพลิเคชัน LINE หรือเปิดผ่านอุปกรณ์อื่น',
    qrAlt: 'QR code to add the EasyBook LINE Official Account',

    /**
     * The three how-to steps, rendered as `<li>`s. The "1. "/"2. "/"3. "
     * prefixes are part of the copy because the list is unstyled by preflight
     * and carries no marker of its own — kept verbatim rather than "fixed".
     */
    steps: [
      '1. เปิดแอปพลิเคชัน LINE และเลือกตัวสแกนคิวอาร์โค้ด',
      '2. สแกนคิวอาร์โค้ดด้านบน และกดเพิ่มเพื่อน EasyBook',
      '3. กลับมาที่หน้านี้ และกดปุ่มด้านล่าง',
    ],

    recheck: 'ตรวจสอบสถานะการเพิ่มเพื่อน',
    /** NOTE: ASCII dots, unlike the '…' used everywhere else. Preserved verbatim. */
    rechecking: 'กำลังตรวจสอบ...',
    /** Set into state when a re-check still reports "not a friend". */
    recheckHint: 'ระบบยังไม่พบสถานะการเป็นเพื่อน โปรดเพิ่มบัญชีทางการเป็นเพื่อนแล้วลองใหม่อีกครั้ง',
  },

  // ----------------------------------------------------------- Registration
  /**
   * The registration form — `create` (UNREGISTERED) and `edit` (PENDING
   * self-edit) render the same component, so both variants live here.
   */
  registration: {
    createHeading: 'กรอกข้อมูลลงทะเบียน',
    /**
     * Renders the same words as `pending.edit`, and stays separate on purpose:
     * that is the Pending screen's BUTTON, this is the form's `<h1>`. Re-titling
     * the form must not silently re-label the button that opens it.
     */
    editHeading: 'แก้ไขข้อมูลลงทะเบียน',

    /** `displayName` is the LINE profile name, absent outside a LIFF session. */
    createIntro: (displayName?: string) =>
      `${displayName ? `สวัสดี ${displayName}! ` : ''}โปรดระบุข้อมูลของคุณ เพื่อให้ผู้ดูแลระบบพิจารณาอนุมัติสิทธิ์การเข้าใช้งาน`,
    editIntro: 'อัปเดตข้อมูลของคุณด้านล่าง และส่งเพื่อขออนุมัติอีกครั้ง',

    createSubmit: 'ยืนยันการลงทะเบียน',
    createSubmitting: 'กำลังยืนยันการลงทะเบียน…',
    editSubmit: 'บันทึกข้อมูล',
    editSubmitting: 'กำลังบันทึกข้อมูล…',
    cancel: 'ยกเลิก',

    firstName: 'ชื่อจริง',
    lastName: 'นามสกุล',
    staffId: 'รหัสบุคลากร',
    phone: 'เบอร์โทรศัพท์',
    /**
     * NOTE: the select labels space the slash ('ฝ่าย / แผนก') while their
     * placeholders and validation messages do not ('เลือกฝ่าย/แผนก'). That
     * inconsistency is pre-existing and preserved verbatim.
     */
    department: 'ฝ่าย / แผนก',
    departmentPlaceholder: 'เลือกฝ่าย/แผนก',
    personnelRole: 'ตำแหน่ง / บทบาท',
    personnelRolePlaceholder: 'เลือกตำแหน่ง/บทบาท',

    /** The dynamic option lists (`loadOptions`): loading / failed / empty. */
    optionsLoading: 'Loading registration options…',
    optionsError: 'We could not load the registration options. Please try again.',
    noOptions:
      'Registration is temporarily unavailable — no options have been configured yet. Please contact the administration.',

    /** Client-side validation. Field-scoped: each rule names its own field. */
    firstNameRequired: 'โปรดระบุชื่อจริง',
    firstNameNoDigits: 'ชื่อจริงจะต้องไม่มีตัวเลข',
    lastNameRequired: 'โปรดระบุนามสกุล',
    lastNameNoDigits: 'นามสกุลจะต้องไม่มีตัวเลข',
    staffIdRequired: 'โปรดระบุรหัสบุคลากร',
    staffIdDigitsOnly: 'รหัสบุคลากรต้องเป็นตัวเลขเท่านั้น',
    /**
     * `count` comes from `RegistrationForm`'s exported `ID_COUNT` at the call
     * site — passing it keeps the message and the rule from drifting apart.
     */
    staffIdLength: (count: number) => `รหัสบุคลากรจะต้องมี ${count} ตัว`,
    phoneRequired: 'โปรดระบุเบอร์โทรศัพท์',
    phoneDigitsOnly: 'เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น',
    /**
     * NOT a formatter: the "10" is baked into the literal today and nothing
     * interpolates it — the rule's own `10` is a separate literal in `validate`.
     * Extracting it verbatim keeps this a copy change; linking the two (as
     * `staffIdLength`/`ID_COUNT` are linked) would be a behaviour change.
     */
    phoneLength: 'เบอร์โทรศัพท์ต้องมี 10 หลัก',
    departmentRequired: 'โปรดเลือกฝ่าย/แผนก',
    personnelRoleRequired: 'โปรดเลือกตำแหน่ง/บทบาท',

    /**
     * Submit failures, mapped from the API error in `HomePage`. `register` and
     * `edit` keep their own copies of the three identical messages
     * (`sessionExpired` / `lineUnreachable` / `failed`) on purpose: they are two
     * surfaces, and re-wording the edit path must not silently re-word the
     * first-time registration path.
     *
     * Each is a FALLBACK for a backend-supplied `err.message`, which is rendered
     * as-is when present. The status-code branching itself is behaviour and
     * lives in `HomePage`.
     */
    registerError: {
      /** 409 — already registered, or the staff ID is taken. */
      conflict: 'This ID is already registered. Please check your details.',
      /** 400 */
      invalid: 'Please check the form and try again.',
      /** 401 */
      sessionExpired: 'Your LINE session has expired. Please reopen the app and try again.',
      /** 502 */
      lineUnreachable: 'We could not reach LINE to verify you. Please try again in a moment.',
      /** Any other ApiError, and any non-ApiError throw. */
      failed: 'Something went wrong. Please try again.',
    },
    editError: {
      /** 403 — no longer PENDING (an admin approved/blocked in the meantime). */
      notEditable:
        'Your registration can no longer be edited — please reopen the app to refresh your status.',
      /** 409 */
      conflict: 'That staff ID is already in use. Please check your details.',
      /** 400 — a selected option was removed, or a field is invalid. */
      invalid: 'Please review your selections and try again.',
      /** 401 */
      sessionExpired: 'Your LINE session has expired. Please reopen the app and try again.',
      /** 502 */
      lineUnreachable: 'We could not reach LINE to verify you. Please try again in a moment.',
      /** Any other ApiError, and any non-ApiError throw. */
      failed: 'Something went wrong. Please try again.',
    },
  },

  // --------------------------------------------------------------- Pending
  /** PENDING: registered, awaiting an administrator's approval. */
  pending: {
    title: 'รอการอนุมัติลงทะเบียน',
    /**
     * One formatter rather than a JSX fragment: the thanks prefix and the body
     * render as adjacent text in the same `<p>` with no markup between them, so
     * joining them changes nothing on screen. `displayName` is absent outside a
     * LIFF session. Note the space after the name is part of the prefix.
     */
    body: (displayName?: string) =>
      `${displayName ? `ขอบคุณ ${displayName} ` : ''}ระบบได้รับข้อมูลการลงทะเบียนของคุณแล้ว โปรดรอผู้ดูแลระบบพิจารณาอนุมัติสิทธิ์การเข้าใช้งาน`,

    /** The read-only echo of what was submitted. */
    summary: {
      fullName: 'ชื่อ-นามสกุล',
      staffId: 'รหัสบุคลากร',
      phone: 'เบอร์โทรศัพท์',
      department: 'ฝ่าย/แผนก',
      personnelRole: 'ตำแหน่ง/บทบาท',
      /** Stands in for any value the API left empty. */
      emptyValue: '—',
    },

    /** Opens the self-edit form (the backend permits edits only while PENDING). */
    edit: 'แก้ไขข้อมูลลงทะเบียน',
  },

  // --------------------------------------------------------------- Allowed
  /** ALLOWED landing: the greeting. */
  hello: {
    /** `name` falls back to {@link UI_STRINGS_CLIENT.hello.fallbackName}. */
    greeting: (name: string) => `Hello, ${name} 👋`,
    /** Used when the LINE profile has no display name (or there is no profile). */
    fallbackName: 'there',
    welcome: 'Welcome to EasyBook.',
  },

  // --------------------------------------------------------------- Blocked
  /** BLOCKED: account suspended, no actions. */
  blocked: {
    title: 'Account suspended',
    body: 'Your account has been suspended. Please contact the administration.',
  },

  // ---------------------------------------------------------- Error screens
  /** A gate call (friendship / status) failed — retryable. */
  gateError: {
    title: 'Something went wrong',
    body: "We couldn't load your account status. Please check your connection and try again.",
  },

  /**
   * Configured-but-tokenless authentication failure (OBS-2): a real LIFF id is
   * present yet `getIdToken()` returned null — most often a LINE Login channel
   * missing the `openid` scope. This copy is a security-adjacent diagnostic, not
   * decoration: `HomePage.test.tsx` pins `body` as a hard-coded anchor so a
   * silent re-word reddens CI rather than shipping.
   */
  authError: {
    title: 'Authentication failed',
    body: "LINE Authentication failed: Missing ID Token. Please contact support or verify that the LINE login channel has the 'openid' scope configured.",
  },
} as const
