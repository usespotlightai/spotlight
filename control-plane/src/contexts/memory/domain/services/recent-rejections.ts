import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { RunContext } from '@memory/domain/value-objects/run-context';

const RECENT_REJECTIONS_MS = 90 * 24 * 60 * 60 * 1000;

const MAX_RECENT_REJECTIONS = 20;

export interface Rejection {
  readonly scope: MemoryScope;
  readonly decidedAt: Date;
}

export const recentRejectionsSince = (now: Date): Date =>
  new Date(now.getTime() - RECENT_REJECTIONS_MS);

export const recentRejectionsAt = <T extends Rejection>(
  rejected: readonly T[],
  runContext: RunContext,
): T[] =>
  rejected
    .filter((each) => each.scope.appliesAt(runContext))
    .sort((one, other) => other.decidedAt.getTime() - one.decidedAt.getTime())
    .slice(0, MAX_RECENT_REJECTIONS);
