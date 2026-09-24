export const RUN_GRANTS = Symbol('RUN_GRANTS');

export interface RunGrantsPort {
  endedFor(runId: string): Promise<void>;
}
