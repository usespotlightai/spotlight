export const RUN_CHANGE_CHECKS = Symbol('RUN_CHANGE_CHECKS');

const CHANGE_CHECK_STATES = [
  'drafting',
  'undrafted',
  'unchecked',
  'checking',
  'passed',
  'failed',
  'skipped',
] as const;

export type ChangeCheckState = (typeof CHANGE_CHECK_STATES)[number];

export interface CheckedChange {
  readonly repository: string | null;
  readonly state: ChangeCheckState;
  readonly skip: string | null;
  readonly failedAt: readonly string[];
  readonly spent: {
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
