import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface JudgingRepository {
  add(judging: Judging): Promise<void>;

  save(judging: Judging): Promise<void>;

  of(runId: RunId): Promise<Judging | null>;

  // Must lock the judging until the outer transaction ends. Then a call to delete it waits until its score is stored.
  ofForScoring(runId: RunId): Promise<Judging | null>;

  nextDueJob(now: Date): Promise<Judging | null>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
