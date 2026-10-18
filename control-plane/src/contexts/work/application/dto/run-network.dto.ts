import type { EgressEnforcement } from '@work/application/contracts/run-journal.contract';
import type {
  ConnectionError,
  ConnectionOutcome,
  ConnectionReason,
} from '@work/domain/value-objects/run-connection.vo';

interface RunConnectionDto {
  readonly host: string;
  readonly port: number;
  readonly bytesOut: number;
  readonly bytesIn: number;
  readonly ms: number;
  readonly outcome: ConnectionOutcome;
  readonly status: number | null;
  readonly reason: ConnectionReason | null;
  readonly error: ConnectionError | null;
  readonly at: string;
}

export interface RunNetworkDto {
  readonly runId: string;
  readonly attempt: number;
  readonly egressEnforcement: EgressEnforcement | null;
  readonly connections: readonly RunConnectionDto[];
}
