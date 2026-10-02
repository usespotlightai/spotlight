import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { Money } from '@work/domain/value-objects/money.vo';

export const RUN_SPENDS = Symbol('RUN_SPENDS');

export interface RunSpend {
  readonly costs: readonly Money[];
  readonly unpricedSessions: number;
  readonly called: boolean;
}

export interface RunSpendReaderPort {
  spendOf(runId: RunId): Promise<RunSpend>;
}
