import type { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface SideBySideJudgingRepository {
  add(judging: SideBySideJudging): Promise<void>;

  save(judging: SideBySideJudging): Promise<void>;

  remove(judging: SideBySideJudging): Promise<void>;

  of(runId: RunId, otherRunId: RunId): Promise<SideBySideJudging | null>;

  ofTeam(teamId: TeamId): Promise<readonly SideBySideJudging[]>;

  nextDueJob(now: Date): Promise<SideBySideJudging | null>;
}
