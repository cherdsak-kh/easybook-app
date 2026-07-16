import type { SystemRole } from '@/lib/api-client'

/**
 * User-facing copy for the Staff Management + Options surfaces, in one place so
 * a component and its tests read the SAME string.
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
 * Staff Management + Options only. Other components keep their inline literals
 * for now — this is deliberately partial, not a project-wide guarantee. It is a
 * UI-label store: never import it into `api-client.ts` or any non-presentational
 * module.
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
    login: {
      heading: 'EasyBook Management System',
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
        `You are signing in with a temporary password. Choose a new one to continue${
          who ? ` as ${who}` : ''
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
