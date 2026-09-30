import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';

export const STATION_RUNS = Symbol('STATION_RUNS');

export interface EndedRunCost {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export interface EndedStationRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly round: number;
  readonly endedAt: Date;
}

export interface StationRunsPort {
  ended(runId: string): Promise<EndedStationRun | null>;

  costsOf(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, EndedRunCost>>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly FingerprintedConfig[]>;
}
