import type { ChangeJudging } from '@insights/domain/aggregates/change-judging.aggregate';
import type { JudgingAttempt } from '@insights/domain/value-objects/judging-attempt';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeJudgingRepository {
  add(judging: ChangeJudging): Promise<void>;

  save(judging: ChangeJudging): Promise<void>;

  of(runId: RunId, attempt: JudgingAttempt): Promise<ChangeJudging | null>;

  nextDueJob(now: Date): Promise<ChangeJudging | null>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
