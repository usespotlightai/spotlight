import type {
  ConfigInOrder,
  EndedRun,
  WorkPort,
} from '@outcomes/application/ports/work.port';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
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
      endedAt: run.endedAt,
    };
  }

  async costsOf(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunCost>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const costs = await this.stations.costsOf(runIds);

    return new Map(
      [...costs].map(([runId, cost]) => [
        runId,
        RunCost.of({
          ms: cost.ms,
          steps: cost.steps,
          faults: cost.faults,
          used: cost.used,
          amount: cost.cost,
          currency: cost.currency,
        }),
      ]),
    );
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
