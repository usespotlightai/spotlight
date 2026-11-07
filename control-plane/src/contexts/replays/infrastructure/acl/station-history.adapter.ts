import type {
  HistoryConfig,
  HistoryRun,
  StationHistoryPort,
} from '@replays/application/ports/station-history.port';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationHistoryPort as WorkStationHistoryPort } from '@work/application/ports/station-history.port';

export class StationHistory implements StationHistoryPort {
  constructor(private readonly history: WorkStationHistoryPort) {}

  async configsNamed(
    fingerprints: readonly string[],
  ): Promise<readonly HistoryConfig[]> {
    return (await this.history.configsNamed(fingerprints)).map((each) => ({
      fingerprint: each.fingerprint,
      config: each.config,
    }));
  }

  async runsAmong(
    station: { readonly stationId: StationId; readonly name: string },
    runIds: readonly string[],
    hiddenTaskIds: readonly string[],
  ): Promise<readonly HistoryRun[]> {
    if (runIds.length === 0) {
      return [];
    }

    return (
      await this.history.runsAmong(
        { stationId: station.stationId.value, stationName: station.name },
        runIds,
        hiddenTaskIds,
      )
    ).map((each) => ({
      runId: each.runId,
      taskId: each.taskId,
      title: each.title,
      fingerprint: each.fingerprint,
      state: each.state,
      attempt: each.attempt,
      harness: each.harness,
      startedAt: each.startedAt,
      endedAt: each.endedAt,
      usage: each.usage,
      changes: each.changes,
      trace: each.trace,
    }));
  }
}
