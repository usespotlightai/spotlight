import type { TeamTraceDto } from '@work/application/dto/team-trace.dto';
import type { RunDigest } from '@work/application/ports/run-digest-reader.port';
import type {
  TeamTraceSummary,
  TraceStation,
} from '@work/application/ports/team-trace-reader.port';
import { together } from '@work/application/read-models/run-digest';

const stationToDto = (station: TraceStation) => ({
  name: station.name.value,
  color: station.color.value,
  position: station.position,
  count: station.count,
});

export const TeamTraceMapper = {
  toDto(
    summary: TeamTraceSummary,
    digests: ReadonlyMap<string, RunDigest>,
  ): TeamTraceDto {
    const spent = together(
      summary.runIds.flatMap((runId) => {
        const held = digests.get(runId.value);
        return held ? [held] : [];
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
      faults: spent.faults,
      cost: spent.cost?.amount ?? null,
      currency: spent.cost?.currency ?? null,
    };
  },
};
