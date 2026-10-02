export const BASELINE_STANDINGS = ['awaiting', 'found', 'unavailable'] as const;

export type BaselineStanding = (typeof BASELINE_STANDINGS)[number];
