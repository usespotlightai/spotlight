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
