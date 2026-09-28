import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';

const REJECTIONS_HEEDED_MS = 90 * 24 * 60 * 60 * 1000;

const MOST_REJECTIONS_HEEDED = 20;

export interface Rejection {
  readonly scope: MemoryScope;
  readonly decidedAt: Date;
}

export const rejectionsHeededSince = (now: Date): Date =>
  new Date(now.getTime() - REJECTIONS_HEEDED_MS);

export const rejectionsHeededAt = <T extends Rejection>(
  rejected: readonly T[],
  site: RunSite,
): T[] =>
  rejected
    .filter((each) => each.scope.appliesAt(site))
    .sort((one, other) => other.decidedAt.getTime() - one.decidedAt.getTime())
    .slice(0, MOST_REJECTIONS_HEEDED);
