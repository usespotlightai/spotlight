export const CHECK_SKIPS = [
  'no-base',
  'no-checkout',
  'checkout-failed',
  'setup-failed',
  'no-room',
  'out-of-time',
  'no-image',
  'unprovisioned',
  'nobody-checked',
  'skipped',
  'undrafted',
  'no-check-asked',
] as const;

export type CheckSkip = (typeof CHECK_SKIPS)[number];

export const UNDRAFTED: CheckSkip = 'undrafted';

export const NO_CHECK_ASKED: CheckSkip = 'no-check-asked';

const SKIPPED: CheckSkip = 'skipped';

export const checkSkipOf = (raw: string | null): CheckSkip =>
  raw !== null && (CHECK_SKIPS as readonly string[]).includes(raw)
    ? (raw as CheckSkip)
    : SKIPPED;
