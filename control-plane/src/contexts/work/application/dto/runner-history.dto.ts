import type { StationConfigShape } from '@work/application/contracts/station-config.contract';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { RunOutcomeShape } from '@work/application/ports/run-outcomes.port';
import type { FileChange } from '@work/application/read-models/file-changes-of';

export interface HistoryCost {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export type HistoryOutcome = RunOutcomeShape & {
  readonly cost: HistoryCost | null;
};

export interface HistoryRunDto {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly fingerprint: string | null;
  readonly state: string;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly outcome: HistoryOutcome | null;
  readonly changes: readonly FileChange[];
  readonly trace: TaskTraceDto;
}

export interface RunnerHistoryDto {
  readonly line: { readonly key: string; readonly name: string };
  readonly station: { readonly key: string; readonly name: string };
  readonly configs: readonly {
    readonly fingerprint: string;
    readonly config: StationConfigShape;
  }[];
  readonly runs: readonly HistoryRunDto[];
}

export type RunnerHistoryAnswer =
  | { readonly kind: 'found'; readonly history: RunnerHistoryDto }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'ambiguous'; readonly lines: readonly string[] };
