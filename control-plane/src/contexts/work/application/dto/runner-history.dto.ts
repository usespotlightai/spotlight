import type { StationConfigShape } from '@work/application/contracts/station-config.contract';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import type { RunResultShape } from '@work/application/ports/run-results.port';

export interface FileChangeDto {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly omitted: boolean;
}

export interface HistoryUsage {
  readonly ms: number | null;
  readonly steps: number;
  readonly errors: number;
  readonly contextTokens: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export type HistoryOutcome = RunResultShape & {
  readonly usage: HistoryUsage | null;
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
  readonly changes: readonly FileChangeDto[];
  readonly trace: TaskTraceDto;
}

export interface WrittenHistoryRun {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly fingerprint: string | null;
  readonly state: string;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly changes: readonly FileChangeDto[];
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
