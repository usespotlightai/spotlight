import type {
  ConfigInOrder,
  EndedRun,
  WorkPort,
} from '@outcomes/application/ports/work.port';
import type { StationRunsPort } from '@work/application/ports/station-runs.port';

export class Work implements WorkPort {
  constructor(private readonly stations: StationRunsPort) {}

  async endedRun(runId: string): Promise<EndedRun | null> {
    const run = await this.stations.ended(runId);

    if (!run) {
      return null;
    }

    return {
      runId: run.runId,
      workspaceId: run.workspaceId,
      teamId: run.teamId,
      lineId: run.lineId,
      stationId: run.stationId,
      taskId: run.taskId,
      fingerprint: run.fingerprint,
      round: run.round,
      harness: run.harness,
      model: run.model,
      effort: run.effort,
      profileKey: run.profileKey,
      repositories: run.repositories,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
    };
  }

  async configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly ConfigInOrder[]> {
    if (fingerprints.length === 0) {
      return [];
    }

    return (await this.stations.configsInOrder(fingerprints)).map((each) => ({
      fingerprint: each.fingerprint,
      config: each.config,
      changes: each.changes,
    }));
  }
}
