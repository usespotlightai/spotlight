import type { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface ChangeJudgingRepository {
  add(judging: ChangeJudging): Promise<void>;

  save(judging: ChangeJudging): Promise<void>;

  remove(judging: ChangeJudging): Promise<void>;

  of(runId: RunId, attempt: JudgingAttempt): Promise<ChangeJudging | null>;

  ofTeam(teamId: TeamId): Promise<readonly ChangeJudging[]>;

  nextDueJob(now: Date): Promise<ChangeJudging | null>;
}
