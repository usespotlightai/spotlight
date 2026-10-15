export const ERROR_REPORTS = Symbol('ERROR_REPORTS');

export interface ErrorAbout {
  readonly source: string;
  readonly workspaceId?: string;
  readonly teamId?: string;
  readonly taskId?: string;
  readonly runId?: string;
}

export interface ErrorReportsPort {
  report(error: unknown, about: ErrorAbout): void;
}
