import type { TeamTraceDto } from '@application/dto/team-trace.dto';
import type {
  TeamTraceSummary,
  TraceStation,
} from '@application/ports/team-trace-reader.port';
import { type RunOutcome, together } from '@domain/services/run-outcome';

const stationToDto = (station: TraceStation) => ({
  name: station.name.value,
  color: station.color.value,
  position: station.position,
  count: station.count,
});

export const TeamTraceMapper = {
  toDto(
    summary: TeamTraceSummary,
    digests: ReadonlyMap<string, RunOutcome>,
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
      // What the task took from first run to last, which is what a reader
      // waited through, rather than the sum of what the agents spoke for.
      ms: summary.endedAt.getTime() - summary.startedAt.getTime(),
      steps: spent.steps,
      faults: spent.faults,
      cost: spent.cost?.amount ?? null,
      currency: spent.cost?.currency ?? null,
    };
  },
};
