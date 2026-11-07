import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MAX_RECALLED = 10;

interface RecallingRun {
  readonly teamId: TeamId;
  readonly replaysFrom: Date | null;
}

export const recallableBy = (memory: Memory, run: RecallingRun): boolean =>
  run.replaysFrom
    ? memory.activeOn(run.teamId, run.replaysFrom)
    : memory.isTeams(run.teamId);

export const recordsRecall = (run: RecallingRun): boolean =>
  run.replaysFrom === null;
