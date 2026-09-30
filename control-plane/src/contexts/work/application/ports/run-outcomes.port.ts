export const RUN_OUTCOMES = Symbol('RUN_OUTCOMES');

type RunEndingShape =
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'abandoned'
  | 'withdrawn'
  | 'superseded';

export interface RunOutcomeShape {
  readonly runId: string;
  readonly fingerprint: string | null;
  readonly endedAt: string;
  readonly ending: RunEndingShape;
  readonly failure: string | null;
  readonly round: number;
  readonly checks: 'passed' | 'failed' | 'skipped' | null;
  readonly next: { readonly act: string; readonly at: string } | null;
  readonly delivery: 'open' | 'merged' | 'closed' | null;
}

export interface RunOutcomesPort {
  of(runIds: readonly string[]): Promise<ReadonlyMap<string, RunOutcomeShape>>;
}
