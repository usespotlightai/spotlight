import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const MAX_RECALLED = 10;

interface RecallingRun {
  readonly teamId: TeamId;
  readonly asOf: Date | null;
}

export const recallableBy = (memory: Memory, run: RecallingRun): boolean =>
  run.asOf ? memory.activeOn(run.teamId, run.asOf) : memory.isTeams(run.teamId);

export const recordsRecall = (run: RecallingRun): boolean => run.asOf === null;
