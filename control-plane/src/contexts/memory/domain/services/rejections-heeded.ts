const REJECTIONS_HEEDED_MS = 90 * 24 * 60 * 60 * 1000;

export const rejectionsHeededSince = (now: Date): Date =>
  new Date(now.getTime() - REJECTIONS_HEEDED_MS);
