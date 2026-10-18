export interface TaskViewDto {
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

export const TASK_VIEWS = Symbol('TASK_VIEWS');

export interface TaskViewsPort {
  of(taskId: string, runId: string | null): Promise<TaskViewDto | null>;

  ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<TaskViewDto | null>;
}
