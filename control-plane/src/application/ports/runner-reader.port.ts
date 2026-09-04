export interface ActiveRunSummary {
  readonly id: string;
  readonly state: string;
}

export interface RunnerSummary {
  readonly id: string;
  readonly name: string;
  readonly harnesses: readonly string[];
  readonly registeredAt: Date;
  readonly lastSeenAt: Date | null;
  readonly revokedAt: Date | null;
  readonly currentRun: ActiveRunSummary | null;
}

export const RUNNER_READER = Symbol('RUNNER_READER');

export interface RunnerReaderPort {
  listAll(): Promise<RunnerSummary[]>;

  /**
   * Whether any runner has reached us and has not been taken away. Enrolling
   * one writes a row and mints a token, and neither of those is a machine.
   */
  anyConnected(): Promise<boolean>;
}
