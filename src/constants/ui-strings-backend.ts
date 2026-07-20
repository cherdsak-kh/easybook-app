import type { AppAccess, SystemRole } from '@/lib/api-client'

/**
 * User-facing copy for the **Backend Portal** (`/backend/*`), in one place so a
 * component and its tests read the SAME string.
 *
 * ## Why this exists
 * Copy was changed out-of-band three times while the tests still queried the old
 * literal, silently reddening the suite. Importing from here means a copy change
 * updates the component and its assertions at once.
 *
 * ## What this is NOT
 * This is **not** i18n. There is no locale, no framework, no `t()` lookup — just
 * an `as const` object you reach into with plain property access. Some values are
 * template *formatters* (`(name) => string`) because the message interpolates
 * runtime data; that is string building at the call site, not a lookup layer.
 * Do not grow this into a locale system without a plan that asks for one.
 *
 * ## Known trade-off (accepted, deliberate)
 * A test asserting `getByLabelText(UI_STRINGS.staff.form.department)` against a
 * component rendering that same constant can no longer catch WRONG COPY — a typo
 * here ships green. Copy correctness moves to code review; the tests' value moves
 * to the behavioural assertions (payload shape, ids, call args, error states,
 * role gating). Do not let a refactor here hollow those out.
 *
 * ## Scope
 * The **Backend Portal** surfaces: the dashboard shell (header, nav), LINE
 * Users, Staff Management, Registration Options, Profile, and the auth screens
 * (login, forced password change, the session gate).
 *
 * The **client portal** (`HomePage.tsx`, `RegistrationForm.tsx` — the LIFF
 * surface end users see) is NOT covered here. Its copy belongs in the sibling
 * `ui-strings-client.ts`, which is intentionally still empty: extracting it is a
 * deliberately deferred task, not an oversight. Do not add client copy to this
 * file, and do not import this file from a client-portal component — the two
 * dictionaries are separate so a Backend Portal re-word can never reach an end
 * user's screen.
 *
 * It is a UI-label store: never import it into `api-client.ts` or any
 * non-presentational module.
 */

/** The `{ title, noun }` copy pair each Options resource section renders. */
export interface OptionCopy {
  /** Section heading, e.g. "Departments (ฝ่าย/แผนก)". */
  readonly title: string
  /** Singular noun for interpolated copy, e.g. "department". */
  readonly noun: string
}

/**
 * Role display names. Shared vocabulary, not a surface: `StaffPage`,
 * `StaffFormModal` and `ProfilePage` each rendered their own identical copy of
 * this map before. `satisfies` keeps it exhaustive against the wire union, so a
 * new `SystemRole` fails the build here rather than rendering `undefined`.
 */
const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STAFF: 'Staff',
} as const satisfies Record<SystemRole, string>

/**
 * A LINE user's access state. Shared vocabulary, not a surface: `AccessBadge`
 * renders it as a pill while `LineUsersPage` renders the same four words as the
 * access-filter's `<option>` labels. The filter used to derive them from the
 * enum (`a.charAt(0) + a.slice(1).toLowerCase()`), which produced the identical
 * text by coincidence — re-word the badge and the filter would have silently
 * disagreed. `satisfies` keeps it exhaustive against the wire union, so a new
 * `AppAccess` fails the build here rather than rendering blank.
 */
const ACCESS_LABELS = {
  ALLOWED: 'Allowed',
  BLOCKED: 'Blocked',
  PENDING: 'Pending',
  UNREGISTERED: 'Unregistered',
} as const satisfies Record<AppAccess, string>

export const UI_STRINGS = {
  /**
   * Generic actions with no surface semantics. Kept deliberately small — field
   * labels and messages stay under their own surface even when the literal
   * repeats, so changing the profile form never silently changes the staff form.
   */
  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    tryAgain: 'Try again',
    closeDialog: 'Close dialog',
    saving: 'Saving…',
  },

  roles: ROLE_LABELS,

  access: ACCESS_LABELS,

  /**
   * The shared `Avatar` fallback. One string: the glyph standing in for initials
   * when a name yields nothing renderable (whitespace-only, or a LINE follower
   * with no display name at all).
   */
  avatar: {
    unknownInitials: '?',
  },

  // ------------------------------------------------------- Dashboard chrome
  /** The dashboard top bar (`Header`). */
  header: {
    /**
     * The product name beside the brand mark. Deliberately NOT shared with
     * `auth.login.heading`, which happens to render the same words: they are two
     * surfaces, and re-wording the login screen must not silently re-brand the
     * dashboard. The brand mark's own `src` stays in the component — this is a
     * copy store, not an asset registry.
     */
    brand: 'EasyBook',
    toggleMenu: 'Toggle navigation menu',
    logout: 'Logout',
    loggingOut: 'Logging out…',
  },

  /** Dashboard navigation (`Sidebar`) and its mobile drawer (`DashboardLayout`). */
  nav: {
    /** The `<nav>` landmark's accessible name. */
    label: 'Dashboard',
    management: 'Management',
    account: 'Account',
    /** The drawer's click-away scrim — a real button, so it needs a real name. */
    closeMenu: 'Close navigation menu',

    /**
     * Link labels. Kept separate from each page's own `heading` even where the
     * words match today: renaming a page's H1 must not silently rename its nav
     * entry.
     */
    /**
     * The Overview link + its page title. Distinct from `nav.label` (the `<nav>`
     * landmark's accessible name, which also reads "Dashboard"): they are two
     * surfaces that happen to coincide today. `usePageTitle` derives the header
     * title from this via `NAV_GROUPS`, so the link and title cannot drift.
     */
    dashboard: 'Dashboard',
    lineUsers: 'LINE Users',
    options: 'Registration Options',
    staff: 'Staff',
    profile: 'My Profile',
  },

  // --------------------------------------------------------------- LINE Users
  lineUsers: {
    heading: 'LINE Users',
    subheading: 'Approve or block people who have added the LINE account.',

    searchLabel: 'Search by name',
    searchPlaceholder: 'Display name…',
    accessLabel: 'Access',
    /** The `<select>`'s accessible name; its visible label reads only "Access". */
    accessFilterLabel: 'Filter by access status',
    /**
     * The unfiltered choice. Sits beside the `access` labels rather than inside
     * them: it is the ABSENCE of a filter, not an access state a user can hold.
     */
    accessFilterAll: 'All',

    loadForbidden: 'You do not have permission to view LINE users.',
    loadFailed: 'Could not load LINE users. Please try again.',
    empty: 'No LINE users match your filters.',

    /** A follower who has never set a LINE display name. */
    unknownUser: 'Unknown user',
    /** `date` is already localised by the call site's `toLocaleDateString`. */
    followedAt: (date: string) => `Followed ${date}`,
    /** Stands in for any value the API left empty, and for an unparseable date. */
    emptyValue: '—',

    /**
     * The status/actions split (design Item 4). The list is a card layout, not a
     * `<table>`, so these name the two right-hand cells for assistive tech rather
     * than rendering as visible `<th>`s. `Status` is the badge cell (no controls);
     * `Actions` is the right-pinned transition cell.
     */
    statusHeader: 'Status',
    actionsHeader: 'Actions',

    updating: 'Updating…',
    /**
     * ADMIN quick actions, gated by the transition matrix (design Item 3). →ALLOWED
     * reads "Approve" from PENDING and "Reinstate" from BLOCKED — the same PATCH,
     * two verbs, because reinstating a blocked user is not the same story as
     * approving a pending one. →BLOCKED is always "Block".
     */
    approve: 'Approve',
    reinstate: 'Reinstate',
    block: 'Block',
    /** Row actions are named per-user: a list of bare "Approve"s is unusable by ear. */
    approveUser: (name: string) => `Approve ${name}`,
    reinstateUser: (name: string) => `Reinstate ${name}`,
    blockUser: (name: string) => `Block ${name}`,
    /** Subject fallback for those labels when the display name is null. */
    thisUser: 'this user',

    /**
     * SUPER_ADMIN's full-state override (design Item 3). ADMIN never sees this: the
     * picker can force ANY `AppAccess` — including UNREGISTERED / PENDING — which
     * the ADMIN matrix forbids. This is the explicit "Edit" affordance the split
     * calls for; the backend still authorises every write.
     */
    editAccess: 'Edit',
    editAccessFor: (name: string) => `Edit access for ${name}`,
    overridePickerLabel: (name: string) => `Set access for ${name}`,
    applyOverride: 'Apply',
    applyOverrideFor: (name: string) => `Apply access change for ${name}`,

    rowGone: 'That user no longer exists — refresh the list.',
    rowForbidden: 'You do not have permission to make that access change.',
    rowFailed: 'Could not update access. Please try again.',

    pagination: {
      label: 'Pagination',
      previous: 'Previous',
      next: 'Next',
      summary: (page: number, totalPages: number, total: number) =>
        `Page ${page} of ${totalPages} · ${total} total`,
    },

    /**
     * The credentials submitted with a registration (`RegistrationDetails`), so
     * an admin approves a PERSON rather than a bare LINE handle.
     */
    registration: {
      /** `registration` is null — a follower who never completed the form. */
      none: 'Not registered',
      realName: 'Real name',
      staffId: 'Staff ID',
      phone: 'Phone',
      role: 'Role',
      department: 'Department',
    },

    /**
     * The admin registration-edit modal (`LineUserRegistrationModal`), opened by
     * the footer's Edit button — but ONLY on a row that HAS a registration (it is
     * hidden when `registration == null`: an UNREGISTERED follower has nothing to
     * edit and the backend would 404). The four field labels it shares with the
     * read-only `registration` block above (staffId / phone / department / role)
     * are reused from there so a re-word stays consistent within this surface;
     * only the first/last-name labels, placeholders, modal chrome, validation and
     * error copy are new here.
     */
    edit: {
      /**
       * Visible label + per-user accessible name for the footer's Edit affordance.
       * Distinct from the SUPER_ADMIN access override's `editAccessFor` above (that
       * edits ACCESS; this edits the registration DETAILS), so assistive tech tells
       * the two apart even though both read "Edit" on screen.
       */
      action: 'Edit',
      actionFor: (name: string) => `Edit registration for ${name}`,

      title: 'Edit registration',
      intro: "Correct this person's submitted registration details.",

      firstName: 'First name',
      lastName: 'Last name',
      departmentPlaceholder: 'Select a department',
      rolePlaceholder: 'Select a role',

      /** The dynamic option lists (`listDepartments` / `listPersonnelRoles`). */
      optionsLoading: 'Loading departments and roles…',
      optionsFailed: 'Could not load departments and roles. Please try again.',
      /** A soft-deleted option the registration still points at: shown disabled. */
      removedOption: (name: string) => `${name} (removed)`,

      /**
       * Client validation, mirroring the backend (and the client RegistrationForm).
       * `count` comes from `RegistrationForm`'s exported `ID_COUNT` / `PHONE_COUNT`
       * at the call site, so the rule and the message cannot drift apart.
       */
      firstNameRequired: 'Please enter a first name.',
      firstNameNoDigits: 'A first name cannot contain digits.',
      lastNameRequired: 'Please enter a last name.',
      lastNameNoDigits: 'A last name cannot contain digits.',
      staffIdRequired: 'Please enter a staff ID.',
      staffIdDigitsOnly: 'The staff ID must contain digits only.',
      staffIdLength: (count: number) => `The staff ID must be exactly ${count} digits.`,
      phoneRequired: 'Please enter a phone number.',
      phoneDigitsOnly: 'The phone number must contain digits only.',
      phoneLength: (count: number) => `The phone number must be exactly ${count} digits.`,
      departmentRequired: 'Please choose a department.',
      departmentRemoved: 'That department was removed. Please choose an active one.',
      roleRequired: 'Please choose a role.',
      roleRemoved: 'That role was removed. Please choose an active one.',

      /**
       * Backend errors surfaced INLINE in the modal (never a logout): 409 for a
       * taken staffId, 400 for validation / a reserved-or-invalid option. A 404
       * (row gone / no registration) closes the modal into the page's row notice;
       * only 401 ends the session.
       */
      staffIdTaken: 'That staff ID is already in use.',
      invalid: 'Please check the highlighted fields and try again.',
      saveFailed: 'Could not save the registration. Please try again.',
    },
  },

  // ------------------------------------------------------------------ Options
  options: {
    heading: 'Registration Options',
    subheading: 'Manage the departments and roles people choose from when they register.',

    /**
     * The two managed resources. `OptionsPage`'s `OptionResource` objects point
     * at these rather than carrying their own `title`/`noun` literals.
     */
    departments: {
      title: 'Departments (ฝ่าย/แผนก)',
      noun: 'department',
    },
    personnelRoles: {
      title: 'Personnel Roles (ตำแหน่ง/บทบาท)',
      noun: 'personnel role',
    },

    add: 'Add',
    rename: 'Rename',
    delete: 'Delete',
    removing: 'Removing…',
    nameLabel: 'Name',

    /**
     * The read-only marker on a system-reserved option row (design Item 2). Only
     * SUPER_ADMIN ever receives such a row (`isSystemReserved === true`), and the
     * backend answers 404 on any PATCH/DELETE of it — so the row hides its
     * Rename/Delete controls and shows this badge instead. There is no control to
     * set or clear the flag; it is display-only.
     */
    reservedBadge: 'Reserved',
    reservedHint: 'System-reserved — managed by the system and cannot be edited or removed here.',

    /** Section title interpolated, lower-cased, exactly as the page renders it. */
    loadForbidden: (title: string) =>
      `You do not have permission to manage ${title.toLowerCase()}.`,
    loadFailed: (title: string) => `Could not load ${title.toLowerCase()}. Please try again.`,
    empty: (title: string) => `No ${title.toLowerCase()} yet. Add one to get started.`,
    deleteRow: (name: string) => `Delete ${name}`,

    removeGone: 'That option was already removed — refreshing the list.',
    removeForbidden: 'You do not have permission to remove this option.',
    removeFailed: 'Could not remove the option. Please try again.',

    form: {
      addTitle: (noun: string) => `Add ${noun}`,
      renameTitle: (noun: string) => `Rename ${noun}`,
      nameRequired: 'Please enter a name.',
      nameTaken: 'That name is already in use.',
      forbidden: 'You do not have permission to perform this action.',
      gone: (noun: string) => `That ${noun} no longer exists.`,
      invalid: 'Please enter a valid name.',
      saveFailed: 'Could not save. Please try again.',
    },
  },

  // -------------------------------------------------------------------- Staff
  staff: {
    heading: 'Staff',
    subheading: 'Manage back-office user accounts.',
    addStaff: 'Add staff',
    empty: 'No staff accounts found.',

    inactiveBadge: 'Inactive',
    passwordNotSetBadge: 'Password not set',

    edit: 'Edit',
    resetPassword: 'Reset Password',
    confirmReset: 'Confirm reset',
    resetting: 'Resetting…',
    deactivate: 'Deactivate',
    deactivating: 'Deactivating…',

    resetPasswordFor: (name: string) => `Reset password for ${name}`,
    deactivateUser: (name: string) => `Deactivate ${name}`,

    listForbidden: 'You do not have permission to view staff.',
    listFailed: 'Could not load staff. Please try again.',
    resetForbidden: 'You do not have permission to reset this password.',
    resetFailed: 'Could not reset the password. Please try again.',
    deactivateForbidden: 'You do not have permission to deactivate this account.',
    deactivateFailed: 'Could not deactivate the account. Please try again.',

    pagination: {
      label: 'Pagination',
      previous: 'Previous',
      next: 'Next',
      summary: (page: number, totalPages: number, total: number) =>
        `Page ${page} of ${totalPages} · ${total} total`,
    },

    /** The create/edit modal (`StaffFormModal`). */
    form: {
      addTitle: 'Add staff member',
      editTitle: 'Edit staff member',

      email: 'Email',
      firstName: 'First name',
      lastName: 'Last name',
      /** The wire field is `personnelRole`; the UI label stays "Position". */
      position: 'Position',
      positionPlaceholder: 'Select a position',
      department: 'Department',
      departmentPlaceholder: 'Select a department',
      phoneNumber: 'Phone number (optional)',
      role: 'Role',

      tempPasswordNote:
        'A temporary password is generated automatically and shown once after you save.',

      optionsLoading: 'Loading departments and positions…',
      optionsFailed: 'Could not load departments and positions. Please try again.',
      /** A soft-deleted option stays visible but disabled. */
      removedOption: (name: string) => `${name} (removed)`,

      departmentRequired: 'Please choose a department.',
      departmentRemoved: 'That department was removed. Please choose an active one.',
      positionRequired: 'Please choose a position.',
      positionRemoved: 'That position was removed. Please choose an active one.',

      forbidden: 'You do not have permission to perform this action.',
      emailTaken: 'That email is already in use.',
      gone: 'That staff member no longer exists.',
      invalid: 'Please check the highlighted fields and try again.',
      saveFailed: 'Could not save. Please try again.',
    },

    /**
     * The show-once temporary-password dialog (`TempPasswordDialog`), reached
     * from both create and reset. Asserted through `StaffPage.test.tsx` rather
     * than a test file of its own — which is exactly why it belongs here: the
     * component/test copy pair it duplicates is real, just split across files.
     */
    tempPassword: {
      /** Title depends on which action issued the password. */
      createdTitle: 'Staff member created',
      resetTitle: 'Password reset',

      /**
       * Split, not a `(userLabel) => string` formatter, because the dialog
       * renders the name emphasised *between* these two halves:
       * `{introBefore} <span class="font-medium">{userLabel}</span>{introAfter}`.
       * Joining them into one formatter would drop the emphasis.
       */
      introBefore: 'Temporary password for',
      introAfter: '. They must change it the first time they sign in.',

      warning: 'Copy it now — this is the only time it will be shown. It cannot be retrieved again.',

      copy: 'Copy',
      copied: 'Copied',
      copySuccess:
        'Copied to the clipboard. Deliver it to them directly — never by an unsecured channel.',
      /** Clipboard denied/insecure context — soft failure, the value is on screen. */
      copyFailed: 'Could not copy automatically. Select the password above and copy it manually.',

      /** The only way to dismiss: closing must be a conscious acknowledgement. */
      acknowledge: 'I have saved it',
    },
  },

  // ------------------------------------------------------------------ Profile
  profile: {
    heading: 'My Profile',
    subheading: 'Update your own details and picture.',
    loadFailed: 'Could not load your profile. Please try again.',

    avatarLabel: 'Profile picture',
    avatarAlt: 'Your profile picture',
    avatarHint: 'JPEG, PNG or WEBP, up to 2 MB.',
    avatarUploading: 'Uploading…',
    avatarUploadingSr: 'Uploading your picture…',
    avatarTooLarge: 'That image is larger than 2 MB. Please choose a smaller one.',
    avatarBadType: 'Unsupported image type. Please choose a JPEG, PNG or WEBP file.',
    avatarRejected: 'That image was rejected. Please choose another.',
    avatarStorageDown: 'Image storage is unavailable right now. Please try again in a moment.',
    avatarUploadFailed: 'Could not upload your picture. Please try again.',

    /**
     * The 1:1 cropping dialog (`AvatarCropModal`), opened by picking a file and
     * the only path to an upload — every avatar is square by construction.
     * Asserted through `ProfilePage.test.tsx` rather than a suite of its own,
     * which is exactly the component/test copy pair this dictionary exists for.
     */
    avatarCrop: {
      title: 'Crop your picture',
      intro: 'Drag to reposition and zoom until the square holds what you want.',
      zoom: 'Zoom',
      /** The confirm action. Deliberately names the outcome, not the mechanic. */
      confirm: 'Use this picture',
      /** Canvas encode is fast, but a large source on a slow phone is not free. */
      cropping: 'Preparing…',
      croppingSr: 'Preparing your cropped picture…',

      failed: 'Could not process that image. Please try another.',
      /**
       * The quality ladder in `crop-image.ts` bottomed out and the result is
       * STILL over 2 MiB. Tells them the one thing that actually helps.
       */
      stillTooLarge:
        'The cropped image is still larger than 2 MB. Try zooming in on a smaller area, or choose a different picture.',
    },

    firstName: 'First name',
    lastName: 'Last name',
    phoneNumber: 'Phone number (optional)',
    email: 'Email',
    saveChanges: 'Save changes',
    saved: 'Profile saved.',
    saveInvalid: 'Please check the highlighted fields and try again.',
    saveFailed: 'Could not save your profile. Please try again.',

    readOnlyHeading: 'Role and assignment',
    readOnlyIntro: 'You cannot change these yourself.',
    /** A SUPER_ADMIN manages these; they are not on the self-edit DTO. */
    managedNote: 'A Super Admin manages this.',
    role: 'Role',
    /** Wire field `personnelRole`; the UI label stays "Position". */
    position: 'Position',
    department: 'Department',
  },

  // --------------------------------------------------------------------- Auth
  auth: {
    /** The session-probe spinner shown by `ProtectedRoute` before it decides. */
    checkingSession: 'Checking your session…',

    login: {
      heading: 'EasyBook',
      subheading: 'เข้าสู่ระบบบริหารจัดการส่วนหลังบ้าน',
      email: 'อีเมล',
      emailPlaceholder: 'example@mail.com',
      password: 'รหัสผ่าน',
      passwordPlaceholder: '********',
      submit: 'เข้าสู่ระบบ',
      submitting: 'กำลังเข้าสู่ระบบ…',

      emailInvalid: 'โปรดระบุอีเมลให้ถูกต้อง',
      passwordRequired: 'โปรดระบุรหัสผ่าน',
      badCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
      rateLimitedIn: (seconds: number) =>
        `ทำรายการซ้ำหลายครั้งเกินไป โปรดลองใหม่อีกครั้งใน ${seconds} วินาที`,
      rateLimited: 'ทำรายการซ้ำหลายครั้งเกินไป โปรดลองใหม่อีกครั้งในภายหลัง',
      unavailable: 'ระบบไม่สามารถใช้งานได้ชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง',
      failed: 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองใหม่อีกครั้ง',
      networkFailed: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ โปรดลองใหม่อีกครั้ง',
    },

    forcePasswordChange: {
      heading: 'Change your password',
      /** `who` is the signed-in user's display name, when known. */
      intro: (who?: string) =>
        `You are signing in with a temporary password. Choose a new one to continue${who ? ` as ${who}` : ''
        }.`,

      currentPassword: 'Current (temporary) password',
      newPassword: 'New password',
      confirmPassword: 'Confirm new password',
      submit: 'Change password',
      submitting: 'Saving your new password…',
      logout: 'Log out',
      loggingOut: 'Logging out…',

      /**
       * `min`/`max` come from the api-client's PASSWORD_* constants at the call
       * site — passing them keeps the message and the rule from drifting apart.
       */
      newPasswordHint: (min: number) =>
        `At least ${min} characters, and different from your current password.`,
      currentRequired: 'Please enter your current password.',
      tooShort: (min: number) => `Your new password must be at least ${min} characters.`,
      tooLong: (max: number) => `Your new password must be ${max} characters or fewer.`,
      mustDiffer: 'Your new password must be different from your current one.',
      mismatch: 'The passwords do not match.',
      invalid: 'Please check your details and try again.',
      failed: 'Could not change your password. Please try again.',
    },
  },
} as const
