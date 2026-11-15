export const SCORE_ORIGINS = ['live', 'backfill'] as const;

export type ScoreOrigin = (typeof SCORE_ORIGINS)[number];

export const LIVE: ScoreOrigin = 'live';
