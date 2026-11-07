export const RUN_CONNECTIONS = Symbol('RUN_CONNECTIONS');

export type ConnectionOutcome =
  | 'passthrough'
  | 'injected'
  | 'blocked'
  | 'failed';

export type ConnectionReason =
  | 'not-allowed'
  | 'private-address'
  | 'not-bound'
  | 'no-such-host'
  | 'timed-out'
  | 'tls-failed'
  | 'unreachable';

export type ConnectionError =
  | 'blocked'
  | 'failed'
  | 'auth-failed'
  | 'server-error';

export interface RunConnectionContract {
  readonly host: string;
  readonly port: number;
  readonly bytesOut: number;
  readonly bytesIn: number;
  readonly ms: number;
  readonly outcome: ConnectionOutcome;
  readonly status: number | null;
  readonly reason: ConnectionReason | null;
  readonly error: ConnectionError | null;
  readonly at: Date;
}

export interface RecordedConnection {
  readonly attempt: number;
  readonly connection: RunConnectionContract;
}

export interface ConnectionOfRun extends RecordedConnection {
  readonly runId: string;
}

export interface RunConnectionsPort {
  of(runId: string): Promise<readonly RecordedConnection[]>;

  errorsIn(runIds: readonly string[]): Promise<readonly ConnectionOfRun[]>;
}
