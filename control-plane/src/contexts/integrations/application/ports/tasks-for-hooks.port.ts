export const TASKS_FOR_HOOKS = Symbol('TASKS_FOR_HOOKS');

export interface TaskView {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly title: string;
  readonly url: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly repositories: readonly string[];
  readonly pullRequest: string | null;
  readonly runId: string | null;
}

export interface TasksForHooksPort {
  of(taskId: string, runId: string | null): Promise<TaskView | null>;

  ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<TaskView | null>;
}
