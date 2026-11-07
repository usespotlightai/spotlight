export const RUN_CHANGE_CHECKS = Symbol('RUN_CHANGE_CHECKS');

export type CheckedChangeStatus =
  | 'generating'
  | 'not-generated'
  | 'unchecked'
  | 'checking'
  | 'passed'
  | 'failed'
  | 'skipped';

export interface CheckedChange {
  readonly repository: string | null;
  readonly status: CheckedChangeStatus;
  readonly skip: string | null;
  readonly failedWhole: boolean;
  readonly failedLayers: readonly string[];
  readonly usage: {
    readonly costs: readonly {
      readonly amount: number;
      readonly currency: string;
    }[];
    readonly unpriced: number;
  };
}

export interface RunChangeChecksPort {
  ofRun(runId: string): Promise<readonly CheckedChange[]>;

  rechecksOfRun(runId: string): Promise<readonly CheckedChange[]>;
}
