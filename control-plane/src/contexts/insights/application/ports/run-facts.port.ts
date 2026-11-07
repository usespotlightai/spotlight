import type {
  RunFact,
  TaskPullRequestFact,
} from '@insights/domain/value-objects/run-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type RunFactOwner =
  | {
      readonly kind: 'team';
      readonly workspaceId: WorkspaceId;
      readonly teamId: TeamId;
    }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId };

export interface RunFactsPort {
  lockTasks(taskIds: readonly TaskId[]): Promise<void>;

  put(facts: readonly RunFact[]): Promise<void>;

  drop(runIds: readonly RunId[]): Promise<void>;

  putTaskPullRequests(
    pullRequests: readonly TaskPullRequestFact[],
  ): Promise<void>;

  dropTaskPullRequests(taskIds: readonly TaskId[]): Promise<void>;

  runsOfTasks(taskIds: readonly TaskId[]): Promise<readonly RunId[]>;

  tasksOfRuns(runIds: readonly RunId[]): Promise<readonly TaskId[]>;

  runsOf(owner: RunFactOwner): Promise<readonly RunId[]>;

  runsEndedSince(since: Date): Promise<readonly RunId[]>;

  differing(facts: readonly RunFact[]): Promise<readonly RunId[]>;

  workspaces(): Promise<readonly WorkspaceId[]>;
}
