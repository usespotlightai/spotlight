import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';

export const STATION_RUNS = Symbol('STATION_RUNS');

export interface EndedStationRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly round: number;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profileKey: string | null;
  readonly repositories: readonly string[];
  readonly skills: readonly string[];
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
}

export interface StationAlertShape {
  readonly measure: string;
  readonly risesBy: number | null;
  readonly above: number | null;
  readonly fallsBy: number | null;
  readonly below: number | null;
  readonly over: number;
}

export interface StationRunsPort {
  ended(runId: string): Promise<EndedStationRun | null>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly FingerprintedConfig[]>;

  alertsAt(stationId: string): Promise<readonly StationAlertShape[] | null>;

  teamSkillKeys(teamId: string): Promise<readonly string[]>;
}
