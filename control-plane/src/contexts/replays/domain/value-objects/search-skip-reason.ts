export const SEARCH_SKIP_REASONS = [
  'no-agent',
  'no-scoring',
  'set-too-small',
  'no-fresh-held-out',
  'ceiling-too-low',
  'noisy',
  'judge-unstable',
  'flaky-checks',
  'no-headroom',
  'monthly-ceiling',
  'pull-request-open',
  'cooldown',
] as const;

export type SearchSkipReason = (typeof SEARCH_SKIP_REASONS)[number];

export const TRANSIENT_SKIP_REASONS = [
  'cooldown',
  'pull-request-open',
  'set-too-small',
  'no-fresh-held-out',
  'monthly-ceiling',
  'no-headroom',
] as const satisfies readonly SearchSkipReason[];

export const isTransientSkip = (reason: SearchSkipReason): boolean =>
  (TRANSIENT_SKIP_REASONS as readonly SearchSkipReason[]).includes(reason);
