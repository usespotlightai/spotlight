const TOMBSTONE_RETENTION_DAYS = 210;

const DAY_MS = 24 * 60 * 60 * 1000;

export const tombstonesExpiredBefore = (now: Date): Date =>
  new Date(now.getTime() - TOMBSTONE_RETENTION_DAYS * DAY_MS);
