export const TRIAL_FACTS = Symbol('TRIAL_FACTS');

export interface TaskRunFacts {
  readonly runId: string;
  readonly taskId: string;
  readonly stationId: string;
  readonly briefed: boolean;
  readonly taskExists: boolean;
  readonly title: string | null;
}

export interface TrialFactsPort {
  ofTaskRuns(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, TaskRunFacts>>;
}
