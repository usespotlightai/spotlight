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

export interface StationTaskRun {
  readonly runId: string;
  readonly taskId: string;
  readonly teamId: string;
}

export interface UnfinishedStationRun {
  readonly runId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly progress: 'queued' | 'in-progress' | 'stopping';
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

export interface TracedRunsWanted {
  readonly taskIds: readonly string[];
  readonly runIds: readonly string[];
  readonly stationIds: readonly string[];
}

export interface TracedWork {
  readonly tasks: readonly TracedTask[];
  readonly stations: readonly TracedStation[];
  readonly outputs: ReadonlyMap<string, string>;
}

export interface StationRunsPort {
  ended(runId: string): Promise<EndedStationRun | null>;

  taskRunOf(runId: string): Promise<StationTaskRun | null>;

  unfinished(teamId: string): Promise<readonly UnfinishedStationRun[]>;

  configsInOrder(
    fingerprints: readonly string[],
  ): Promise<readonly FingerprintedConfig[]>;

  traced(wanted: TracedRunsWanted): Promise<TracedWork>;
}
