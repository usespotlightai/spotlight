import type {
  JournalStepDto,
  RunSpanDto,
} from '@application/dto/run-journal.dto';
import type { NodeKind, Tone } from '@domain/services/trace-of';

/** One row of a trace, and everything hanging beneath it. */
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
  readonly children: readonly TraceNodeDto[];
}

export interface TaskTraceDto {
  readonly startedAt: string | null;
  readonly ms: number;
  readonly rows: number;
  readonly faults: number;
  readonly roots: readonly TraceNodeDto[];
}
