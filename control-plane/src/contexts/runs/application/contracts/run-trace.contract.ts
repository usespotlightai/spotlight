import type {
  EgressEnforcement,
  JournalStep,
  RunSpan,
  SpentCost,
} from '@runs/application/contracts/run-journal.contract';
import type { RunConnectionContract } from '@runs/application/ports/run-connections.port';

export type NodeKind = 'run' | 'phase' | 'step' | 'span' | 'connection';

export type Category = 'agent' | 'overhead' | 'failed';

export interface RunToTrace {
  readonly id: string;
  readonly station: { readonly name: string } | null;
  readonly harness: string;
  readonly failed: boolean;
  readonly attempt: number;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly endedAt: Date | null;
}

export interface TracedConnection {
  readonly connection: RunConnectionContract;
  readonly count: number;
}

export interface TraceNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly from: Date;
  readonly to: Date;
  readonly category: Category;
  readonly step: JournalStep | null;
  readonly span: RunSpan | null;
  readonly cost: SpentCost | null;
  readonly connection: TracedConnection | null;
  readonly egressEnforcement: EgressEnforcement | null;
  readonly children: readonly TraceNode[];
}

export interface Trace {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly rows: number;
  readonly errors: number;
  readonly roots: readonly TraceNode[];
}
