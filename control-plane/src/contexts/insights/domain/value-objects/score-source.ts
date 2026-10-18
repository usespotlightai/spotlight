export const SCORE_SOURCES = ['judge', 'person'] as const;

export type ScoreSource = (typeof SCORE_SOURCES)[number];
