export const RUN_RESULTS = Symbol('RUN_RESULTS');

type RunEndingShape =
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'exhausted'
  | 'cancelled'
  | 'superseded';

export interface RunResultShape {
  readonly runId: string;
  readonly fingerprint: string | null;
  readonly endedAt: string;
  readonly ending: RunEndingShape;
  readonly failure: string | null;
  readonly visit: number;
  readonly checks: 'passed' | 'failed' | 'skipped' | null;
  readonly firstHumanAction: {
    readonly kind: string;
    readonly at: string;
  } | null;
  readonly pullRequestState: 'open' | 'merged' | 'closed' | null;
}

export interface RunResultsPort {
  of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunResultShape>>;
}
