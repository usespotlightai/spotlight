import type { PairJudging } from '@outcomes/domain/aggregates/pair-judging.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PairJudgingRepository {
  add(judging: PairJudging): Promise<void>;

  save(judging: PairJudging): Promise<void>;

  of(runId: RunId, against: RunId): Promise<PairJudging | null>;

  nextDueJob(now: Date): Promise<PairJudging | null>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
