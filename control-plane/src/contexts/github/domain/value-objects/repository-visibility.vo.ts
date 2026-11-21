export type RepositoryVisibility = 'public' | 'private';

export const VISIBILITY_TTL_MS = 60 * 60 * 1000;

export const isFresh = (checkedAt: Date, now: Date, ttlMs: number): boolean =>
  now.getTime() - checkedAt.getTime() < ttlMs;
