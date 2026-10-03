export type RunTurnout =
  | 'accepted'
  | 'sent-back'
  | 'asked'
  | 'failed'
  | 'other';

export const RUN_ACCEPTANCE = Symbol('RUN_ACCEPTANCE');

export interface RunAcceptancePort {
  acceptedAfter(runId: string): Promise<boolean>;

  turnouts(runIds: readonly string[]): Promise<ReadonlyMap<string, RunTurnout>>;
}
