import type { RunJournal } from '@runs/application/contracts/run-journal.contract';
import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import type {
  RunUsageFacts,
  RunUsageReaderPort,
} from '@runs/application/ports/run-usage-reader.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  HistoryUsage,
  WrittenHistoryRun,
} from '@work/application/dto/runner-history.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type {
  HistoryConfig,
  HistoryStation,
  StationHistoryPort,
  StationHistoryRun,
} from '@work/application/ports/station-history.port';
import type {
  StationRunReaderPort,
  StationRunRow,
} from '@work/application/ports/station-run-reader.port';

export const historyUsageOf = (
  usage: RunUsageFacts | null,
): HistoryUsage | null =>
  usage && {
    ms: usage.ms,
    steps: usage.steps,
    errors: usage.errors,
    contextTokens: usage.contextTokens,
    cost: usage.cost?.amount ?? null,
    currency: usage.cost?.currency ?? null,
  };

export class StationRunHistories implements StationHistoryPort {
  constructor(
    private readonly stations: StationRunReaderPort,
    private readonly usages: RunUsageReaderPort,
    private readonly connections: RunConnectionsPort,
    private readonly readings: RunJournalReadingsPort,
  ) {}

  async configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly HistoryConfig[]> {
    return fingerprints.length === 0
      ? []
      : (await this.stations.configsNamed([...new Set(fingerprints)])).map(
          (each) => ({ fingerprint: each.fingerprint, config: each.parts }),
        );
  }

  async runsAmong(
    station: HistoryStation,
    runIds: readonly string[],
    hiddenTaskIds: readonly string[],
  ): Promise<readonly StationHistoryRun[]> {
    const rows = (
      await this.stations.endedAmong(station.stationId, runIds)
    ).filter((each) => !hiddenTaskIds.includes(each.taskId));
    const [written, usages] = await Promise.all([
      this.written(rows, station.stationName),
      this.usages.forRuns(rows.map((each) => RunId.of(each.runId))),
    ]);

    return written.map((each) => ({
      ...each,
      usage: historyUsageOf(usages.get(each.runId) ?? null),
    }));
  }

  async written(
    runs: readonly StationRunRow[],
    station: string,
  ): Promise<readonly WrittenHistoryRun[]> {
    const runIds = runs.map((each) => each.runId);
    const [found, errors] = await Promise.all([
      this.stations.journalsOf(runIds),
      this.connections.errorsIn(runIds),
    ]);
    const journals = new Map<string, RunJournal>(
      found.map((journal) => [journal.runId, journal]),
    );

    return runs.map((each) => {
      const journal = journals.get(each.runId) ?? null;

      return {
        runId: each.runId,
        taskId: each.taskId,
        title: each.title,
        fingerprint: each.fingerprint,
        state: each.state,
        attempt: each.attempt,
        harness: each.harness,
        startedAt: each.startedAt.toISOString(),
        endedAt: each.endedAt.toISOString(),
        changes: journal
          ? this.readings.fileChangesOf(journal).map((change) => ({
              path: change.path,
              before: change.before,
              after: change.after,
              omitted: change.omitted,
            }))
          : [],
        trace: TaskTraceMapper.toDto(
          this.readings.traceOf(
            [
              {
                id: each.runId,
                station: station ? { name: station } : null,
                harness: each.harness,
                failed: each.state === 'failed',
                attempt: each.attempt,
                startedAt: each.startedAt,
                updatedAt: each.endedAt,
                endedAt: each.endedAt,
              },
            ],
            journal ? [journal] : [],
            errors,
          ),
        ),
      };
    });
  }
}
