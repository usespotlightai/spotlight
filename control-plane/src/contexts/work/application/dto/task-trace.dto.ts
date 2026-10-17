import type { EgressEnforcement } from '@work/application/contracts/run-journal.contract';
import type {
  JournalStepDto,
  RunSpanDto,
} from '@work/application/dto/run-journal.dto';
import type { NodeKind, Tone } from '@work/application/read-models/trace-of';
import type {
  ConnectionOutcome,
  ConnectionReason,
  ConnectionTrouble,
} from '@work/domain/value-objects/run-connection.vo';

export interface TraceConnectionDto {
  readonly host: string;
  readonly port: number;
  readonly outcome: ConnectionOutcome;
  readonly status: number | null;
  readonly reason: ConnectionReason | null;
  readonly trouble: ConnectionTrouble | null;
  readonly times: number;
}

export interface TraceNodeDto {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly startedAt: string;
  readonly ms: number;
  readonly tone: Tone;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly step: JournalStepDto | null;
  readonly span: RunSpanDto | null;
  readonly connection: TraceConnectionDto | null;
  readonly egress: EgressEnforcement | null;
  readonly children: readonly TraceNodeDto[];
}

export interface TaskTraceDto {
  readonly startedAt: string | null;
  readonly ms: number;
  readonly rows: number;
  readonly faults: number;
  readonly roots: readonly TraceNodeDto[];
}
