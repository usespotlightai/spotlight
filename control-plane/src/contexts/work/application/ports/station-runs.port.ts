import type { FingerprintedConfig } from '@work/application/contracts/station-config.contract';
import type { TracedWanted } from '@work/application/ports/station-run-reader.port';
import type { Progress } from '@work/domain/value-objects/run-state';

export const STATION_RUNS = Symbol('STATION_RUNS');

export interface EndedStationRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly visit: number;
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

export interface UnfinishedStationRun {
  readonly runId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly progress: Progress;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
}

interface TracedStation {
  readonly stationId: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly count: number;
}

interface TracedTask {
  readonly taskId: string;
  readonly title: string;
  readonly input: string | null;
  readonly stationId: string;
}

export interface TracedWork {
  readonly tasks: readonly TracedTask[];
  readonly stations: readonly TracedStation[];
  readonly outputs: ReadonlyMap<string, string>;
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

  unfinished(teamId: string): Promise<readonly UnfinishedStationRun[]>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly FingerprintedConfig[]>;

  alertsAt(stationId: string): Promise<readonly StationAlertShape[] | null>;

  teamSkillKeys(teamId: string): Promise<readonly string[]>;

  traced(wanted: TracedWanted): Promise<TracedWork>;
}
