export interface ActiveRunSummary {
  readonly id: string;
  readonly state: string;
}

export interface RunnerSummary {
  readonly id: string;
  readonly alias: string;
  readonly pool: string;
  readonly registeredAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
  readonly currentRun: ActiveRunSummary | null;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  listAll(): Promise<RunnerSummary[]>;
}
