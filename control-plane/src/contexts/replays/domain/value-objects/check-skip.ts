const CHECK_SKIPS = [
  'no-base',
  'no-checkout',
  'checkout-failed',
  'setup-failed',
  'workspace-failed',
  'out-of-time',
  'no-image',
  'provision-failed',
  'queue-timeout',
  'skipped',
  'not-generated',
  'no-check-asked',
] as const;

export type CheckSkip = (typeof CHECK_SKIPS)[number];

export const NOT_GENERATED: CheckSkip = 'not-generated';

export const NO_CHECK_ASKED: CheckSkip = 'no-check-asked';

const SKIPPED: CheckSkip = 'skipped';

export const checkSkipOf = (raw: string | null): CheckSkip =>
  raw !== null && (CHECK_SKIPS as readonly string[]).includes(raw)
    ? (raw as CheckSkip)
    : SKIPPED;
