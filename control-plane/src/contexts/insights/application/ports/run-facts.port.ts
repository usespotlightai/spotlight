import type {
  RunFact,
  TaskPullRequestFact,
} from '@insights/domain/value-objects/run-fact.vo';

export type RunFactOwner =
  | {
      readonly kind: 'team';
      readonly workspaceId: string;
      readonly teamId: string;
    }
  | { readonly kind: 'workspace'; readonly workspaceId: string };

export interface RunFactsPort {
  lockTasks(taskIds: readonly string[]): Promise<void>;

  put(facts: readonly RunFact[]): Promise<void>;

  drop(runIds: readonly string[]): Promise<void>;

  putTaskPullRequests(
    pullRequests: readonly TaskPullRequestFact[],
  ): Promise<void>;

  dropTaskPullRequests(taskIds: readonly string[]): Promise<void>;

  runsOfTasks(taskIds: readonly string[]): Promise<readonly string[]>;

  tasksOfRuns(runIds: readonly string[]): Promise<readonly string[]>;

  runsOf(owner: RunFactOwner): Promise<readonly string[]>;

  runsEndedSince(since: Date): Promise<readonly string[]>;

  differing(facts: readonly RunFact[]): Promise<readonly string[]>;

  workspaces(): Promise<readonly string[]>;
}
