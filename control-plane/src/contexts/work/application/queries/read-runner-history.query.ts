export interface HistoryWanted {
  readonly station: string;
  readonly line: string | null;
  readonly fingerprint: string | null;
  readonly outcome: string | null;
  readonly since: string | null;
  readonly last: number | null;
}

export class ReadRunnerHistoryQuery {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
    readonly wanted: HistoryWanted,
  ) {}
}
