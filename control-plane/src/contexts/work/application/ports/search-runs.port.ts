export const SEARCH_RUNS = Symbol('SEARCH_RUNS');

export interface LeasedSearchRun {
  readonly searchId: string;
  readonly iteration: number;
}

export interface SearchRunStatus {
  readonly runId: string;
  readonly phase: 'queued' | 'running' | 'ended';
  readonly failed: boolean;
  readonly started: boolean;
  readonly queuedAt: Date;
  readonly endedAt: Date | null;
}

export interface SearchRunsPort {
  leasedSearchRun(
    runId: string,
    runnerId: string,
  ): Promise<LeasedSearchRun | null>;

  statuses(runIds: readonly string[]): Promise<readonly SearchRunStatus[]>;
}
