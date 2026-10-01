import type { Score } from '@outcomes/domain/aggregates/score.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StationScores {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly rubricVersion?: string;
  readonly last: number;
}

export interface ScoreRepository {
  add(score: Score): Promise<void>;

  save(score: Score): Promise<void>;

  judgeOf(runId: RunId, rubricVersion: string): Promise<Score | null>;

  gradeBy(runId: RunId, by: UserId): Promise<Score | null>;

  ofRuns(runIds: readonly RunId[]): Promise<readonly Score[]>;

  judgedAtStation(criteria: StationScores): Promise<readonly Score[]>;

  removeForTask(taskId: TaskId): Promise<void>;

  removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeForWorkspace(workspaceId: WorkspaceId): Promise<void>;
}
