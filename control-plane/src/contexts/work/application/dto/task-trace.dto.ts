import type { EgressEnforcement } from '@runs/application/contracts/run-journal.contract';
import type {
  Category,
  NodeKind,
} from '@runs/application/contracts/run-trace.contract';
import type {
  ConnectionError,
  ConnectionOutcome,
  ConnectionReason,
} from '@runs/application/ports/run-connections.port';
import type {
  JournalStepDto,
  RunSpanDto,
} from '@work/application/dto/run-journal.dto';

const listOf = <T extends string>(all: Record<T, true>): readonly T[] =>
  Object.keys(all) as T[];

export const TRACE_CONNECTION_OUTCOMES = listOf<ConnectionOutcome>({
  passthrough: true,
  injected: true,
  blocked: true,
  failed: true,
});

export const TRACE_CONNECTION_REASONS = listOf<ConnectionReason>({
  'not-allowed': true,
  'private-address': true,
  'not-bound': true,
  'no-such-host': true,
  'timed-out': true,
  'tls-failed': true,
  unreachable: true,
});

export const TRACE_CONNECTION_ERRORS = listOf<ConnectionError>({
  blocked: true,
  failed: true,
  'auth-failed': true,
  'server-error': true,
});

export interface TraceConnectionDto {
  readonly host: string;
  readonly port: number;
  readonly outcome: ConnectionOutcome;
  readonly status: number | null;
  readonly reason: ConnectionReason | null;
  readonly error: ConnectionError | null;
  readonly count: number;
}

export interface TraceNodeDto {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly startedAt: string;
  readonly ms: number;
  readonly category: Category;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly step: JournalStepDto | null;
  readonly span: RunSpanDto | null;
  readonly connection: TraceConnectionDto | null;
  readonly egressEnforcement: EgressEnforcement | null;
  readonly children: readonly TraceNodeDto[];
}

export interface TaskTraceDto {
  readonly startedAt: string | null;
  readonly ms: number;
  readonly rows: number;
  readonly errors: number;
  readonly roots: readonly TraceNodeDto[];
}
