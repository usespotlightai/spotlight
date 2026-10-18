import type {
  TeamTraceDto,
  TeamTracesDto,
} from '@work/application/dto/team-trace.dto';
import type { RunUsage } from '@work/application/ports/run-usage-reader.port';
import type {
  TeamTraceSummary,
  TraceStation,
} from '@work/application/ports/team-trace-reader.port';
import { together } from '@work/application/read-models/run-usage';
import type { VolumeBucket } from '@work/domain/services/trace-volume';
import type { TraceRange } from '@work/domain/value-objects/trace-range.vo';

const stationToDto = (station: TraceStation) => ({
  name: station.name.value,
  color: station.color.value,
  position: station.position,
  count: station.count,
});

export const TeamTraceMapper = {
  toDto(
    summary: TeamTraceSummary,
    usages: ReadonlyMap<string, RunUsage>,
  ): TeamTraceDto {
    const spent = together(
      summary.runIds.flatMap((runId) => {
        const usage = usages.get(runId.value);
        return usage ? [usage] : [];
      }),
    );

    return {
      taskId: summary.taskId.value,
      title: summary.title,
      station: summary.station && stationToDto(summary.station),
      stations: summary.stations.map(stationToDto),
      harness: summary.harness.value,
      state: summary.state,
      startedAt: summary.startedAt.toISOString(),
      runs: summary.runs,
      input: summary.input,
      output: summary.output,
      ms: summary.endedAt.getTime() - summary.startedAt.getTime(),
      steps: spent.steps,
      faults: spent.errors,
      cost: spent.cost?.amount ?? null,
      currency: spent.cost?.currency ?? null,
    };
  },
  toTracesDto(
    range: TraceRange,
    volume: readonly VolumeBucket[],
    traces: readonly TeamTraceDto[],
  ): TeamTracesDto {
    return {
      range: range.name,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      volume: volume.map((bucket) => ({
        from: bucket.from.toISOString(),
        to: bucket.to.toISOString(),
        count: bucket.count,
        faults: bucket.faults,
      })),
      traces,
    };
  },
};
