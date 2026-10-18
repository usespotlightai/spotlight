export const BASELINE_STATUSES = ['awaiting', 'found', 'unavailable'] as const;

export type BaselineStatus = (typeof BASELINE_STATUSES)[number];
