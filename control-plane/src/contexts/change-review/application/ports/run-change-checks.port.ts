import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
export const RUN_CHANGE_CHECKS = Symbol('RUN_CHANGE_CHECKS');

type CheckedChangeStatus =
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
  ofRun(runId: RunId): Promise<readonly CheckedChange[]>;

  rechecksOfRun(runId: RunId): Promise<readonly CheckedChange[]>;
}
