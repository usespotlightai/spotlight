import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type { RunConnection } from '@runs/domain/value-objects/run-connection.vo';

export const RUN_CONNECTION_LEDGER = Symbol('RUN_CONNECTION_LEDGER');

export interface RunConnectionLedgerPort {
  record(
    attempt: RunAttempt,
    connections: readonly RunConnection[],
  ): Promise<void>;

  purgeBefore(before: Date, max: number): Promise<number>;
}
