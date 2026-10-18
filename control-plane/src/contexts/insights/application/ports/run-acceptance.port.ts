export type RunDisposition =
  | 'accepted'
  | 'sent-back'
  | 'asked'
  | 'failed'
  | 'other';

export const RUN_ACCEPTANCE = Symbol('RUN_ACCEPTANCE');

export interface RunAcceptancePort {
  acceptedAfter(runId: string): Promise<boolean>;

  dispositions(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunDisposition>>;
}
