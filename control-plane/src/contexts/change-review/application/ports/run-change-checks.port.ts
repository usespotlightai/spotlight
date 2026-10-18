export const RUN_CHANGE_CHECKS = Symbol('RUN_CHANGE_CHECKS');

const CHANGE_CHECK_STATUSES = [
  'generating',
  'not-generated',
  'unchecked',
  'checking',
  'passed',
  'failed',
  'skipped',
] as const;

export type ChangeCheckStatus = (typeof CHANGE_CHECK_STATUSES)[number];

export interface CheckedChange {
  readonly repository: string | null;
  readonly status: ChangeCheckStatus;
  readonly skip: string | null;
  readonly failedAt: readonly string[];
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
