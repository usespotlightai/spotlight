import type { RunToTrace } from '@runs/application/contracts/run-trace.contract';
import type { TaskRunSummary } from '@work/application/ports/run-reader.port';

export const labelledRun = (run: TaskRunSummary): RunToTrace => ({
  id: run.id,
  station: run.station && { name: run.station.name },
  harness: run.harness,
  failed: run.state === 'failed',
  attempt: run.attempt,
  startedAt: run.startedAt,
  updatedAt: run.updatedAt,
  endedAt: run.endedAt,
});
