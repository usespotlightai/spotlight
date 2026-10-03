import type { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import type { JudgingRound } from '@outcomes/domain/value-objects/judging-round';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChangeJudgingRepository {
  add(judging: ChangeJudging): Promise<void>;

  save(judging: ChangeJudging): Promise<void>;

  of(runId: RunId, round: JudgingRound): Promise<ChangeJudging | null>;

  dueForWork(now: Date): Promise<ChangeJudging | null>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
