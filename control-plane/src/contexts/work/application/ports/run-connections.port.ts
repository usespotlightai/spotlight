import type { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import type { RunConnection } from '@work/domain/value-objects/run-connection.vo';

export const RUN_CONNECTIONS = Symbol('RUN_CONNECTIONS');

export interface RecordedConnection {
  readonly attempt: number;
  readonly connection: RunConnection;
}

export interface ConnectionOfRun extends RecordedConnection {
  readonly runId: string;
}

export interface RunConnectionsPort {
  record(
    attempt: RunAttempt,
    connections: readonly RunConnection[],
  ): Promise<void>;

  of(runId: string): Promise<readonly RecordedConnection[]>;

  wentWrongIn(runIds: readonly string[]): Promise<readonly ConnectionOfRun[]>;

  forgetBefore(before: Date, most: number): Promise<number>;
}
