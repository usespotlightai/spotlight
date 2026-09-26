export interface HookedTaskDto {
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

export const HOOKED_TASKS = Symbol('HOOKED_TASKS');

export interface HookedTasksPort {
  of(taskId: string, runId: string | null): Promise<HookedTaskDto | null>;

  ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<HookedTaskDto | null>;
}
