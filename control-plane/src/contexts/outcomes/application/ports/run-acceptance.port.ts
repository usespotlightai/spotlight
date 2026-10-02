export const RUN_ACCEPTANCE = Symbol('RUN_ACCEPTANCE');

export interface RunAcceptancePort {
  acceptedAfter(runId: string): Promise<boolean>;
}
