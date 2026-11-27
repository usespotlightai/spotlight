export const RUN_RESULTS = Symbol('RUN_RESULTS');

export const RUN_HUMAN_ACTION_KINDS = [
  'started',
  'parked',
  'accepted',
  'sent-back',
  'held-as-wrong',
  'answered',
] as const;

export type RunHumanActionKind = (typeof RUN_HUMAN_ACTION_KINDS)[number];

export const PEOPLE_VERDICT_SOURCES = [
  'accepted',
  'sent-back',
  'merged',
  'held-as-wrong',
  'marked-right',
  'marked-wrong',
] as const;

export type PeopleVerdictSource = (typeof PEOPLE_VERDICT_SOURCES)[number];

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
  readonly runNumber: number;
  readonly checks: 'passed' | 'failed' | 'skipped' | null;
  readonly humanAction: {
    readonly kind: RunHumanActionKind;
    readonly at: string;
  } | null;
  readonly pullRequestState: 'open' | 'merged' | 'closed' | null;
  readonly peopleVerdict: {
    readonly passes: boolean;
    readonly from: PeopleVerdictSource;
  } | null;
}

export interface RunResultsPort {
  of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunResultShape>>;
}
