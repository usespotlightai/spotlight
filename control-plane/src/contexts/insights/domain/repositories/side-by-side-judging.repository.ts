import type { SideBySideJudging } from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SideBySideJudgingRepository {
  add(judging: SideBySideJudging): Promise<void>;

  save(judging: SideBySideJudging): Promise<void>;

  of(runId: RunId, other: RunId): Promise<SideBySideJudging | null>;

  nextDueJob(now: Date): Promise<SideBySideJudging | null>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
