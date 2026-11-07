import type { RunJournal } from '@runs/application/contracts/run-journal.contract';
import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@runs/application/ports/run-usage-reader.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
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
import { fileChangesOf } from '@work/application/read-models/file-changes-of';
import { connectionsOf, traceOf } from '@work/application/read-models/trace-of';

export const historyUsageOf = (usage: RunUsage | null): HistoryUsage | null =>
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
        changes: journal ? fileChangesOf(journal) : [],
        trace: TaskTraceMapper.toDto(
          traceOf([
            {
              id: RunId.of(each.runId),
              station: StationName.maybe(station),
              harness: each.harness,
              state: each.state,
              attempt: each.attempt,
              startedAt: each.startedAt,
              endedAt: each.endedAt,
              journal,
              connections: connectionsOf(errors, each.runId, each.attempt),
            },
          ]),
        ),
      };
    });
  }
}
