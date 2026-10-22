import type { PersonNameDto } from '@insights/application/dto/insights.dto';
import type {
  TracedStation,
  TracedWork,
} from '@insights/application/ports/work.port';
import type { VolumeBucket } from '@insights/domain/services/trace-volume';
import type { Trace, TraceRun } from '@insights/domain/services/traces';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunProgress } from '@insights/domain/value-objects/run-progress';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';
import type { TraceRange } from '@insights/domain/value-objects/trace-range.vo';

export interface TraceStationDto {
  readonly stationId: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

export interface TraceRunDto {
  readonly runId: string;
  readonly station: TraceStationDto | null;
  readonly progress: RunProgress | null;
  readonly ending: RunEnding | null;
  readonly failure: string | null;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly ms: number | null;
  readonly errors: number | null;
  readonly cost: Money | null;
}

export interface InsightsTraceDto {
  readonly taskId: string;
  readonly title: string;
  readonly input: string | null;
  readonly output: string | null;
  readonly station: TraceStationDto | null;
  readonly stations: readonly TraceStationDto[];
  readonly startedAt: string;
  readonly ms: number | null;
  readonly errors: number;
  readonly cost: Money | null;
  readonly total: number;
  readonly runs: readonly TraceRunDto[];
}

export interface TraceVolumeBucketDto {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly errors: number;
}

export interface InsightsTracesDto {
  readonly range: string;
  readonly from: string;
  readonly to: string;
  readonly volume: readonly TraceVolumeBucketDto[];
  readonly traces: readonly InsightsTraceDto[];
  readonly matched: number;
  readonly truncated: boolean;
  readonly people: readonly PersonNameDto[];
}

const traceRunOf = (
  run: TraceRun,
  stations: ReadonlyMap<string, TracedStation>,
): TraceRunDto =>
  run.kind === 'ended'
    ? {
        runId: run.runId,
        station: stations.get(run.stationId) ?? null,
        progress: null,
        ending: run.ending,
        failure: run.failure,
        openedBy: run.openedBy,
        harness: run.harness,
        model: run.model,
        startedAt: (run.startedAt ?? run.queuedAt ?? run.endedAt).toISOString(),
        endedAt: run.endedAt.toISOString(),
        ms: run.ms,
        errors: run.errors,
        cost: run.cost,
      }
    : {
        runId: run.runId,
        station: stations.get(run.stationId) ?? null,
        progress: run.progress,
        ending: null,
        failure: null,
        openedBy: run.openedBy,
        harness: run.harness,
        model: run.model,
        startedAt: (run.startedAt ?? run.queuedAt).toISOString(),
        endedAt: null,
        ms: null,
        errors: null,
        cost: null,
      };

export const insightsTracesOf = (
  range: TraceRange,
  volume: readonly VolumeBucket[],
  traces: readonly Trace[],
  work: TracedWork,
  truncated: boolean,
  matched: number,
  people: readonly PersonNameDto[],
): InsightsTracesDto => {
  const tasks = new Map(work.tasks.map((each) => [each.taskId, each]));
  const stations = new Map(work.stations.map((each) => [each.stationId, each]));

  return {
    range: range.name,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    volume: volume.map((bucket) => ({
      from: bucket.from.toISOString(),
      to: bucket.to.toISOString(),
      count: bucket.count,
      errors: bucket.errors,
    })),
    traces: traces.flatMap((trace) => {
      const task = tasks.get(trace.taskId);

      if (!task) {
        return [];
      }

      const station = stations.get(task.stationId) ?? null;
      const passed = new Map(
        trace.runs.flatMap((run) => {
          const at = stations.get(run.stationId);
          return at ? [[at.stationId, at] as const] : [];
        }),
      );

      if (station) {
        passed.set(station.stationId, station);
      }

      return [
        {
          taskId: trace.taskId,
          title: task.title,
          input: task.input,
          output: work.outputs.get(trace.taskId) ?? null,
          station,
          stations: [...passed.values()].sort(
            (one, other) => one.position - other.position,
          ),
          startedAt: trace.startedAt.toISOString(),
          ms: trace.ms,
          errors: trace.errors,
          cost: trace.spending.spend,
          total: trace.total,
          runs: trace.runs.map((run) => traceRunOf(run, stations)),
        },
      ];
    }),
    matched,
    truncated,
    people,
  };
};
