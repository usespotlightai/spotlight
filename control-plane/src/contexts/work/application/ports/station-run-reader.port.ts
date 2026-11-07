import type { RunJournal } from '@runs/application/contracts/run-journal.contract';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Progress } from '@work/domain/value-objects/progress';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

export const STATION_RUN_READER = Symbol('STATION_RUN_READER');

export interface EndedRunRow {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly earlier: readonly TaskRunState[];
  readonly harness: string;
  readonly config: StationConfigParts | null;
  readonly reviewing: string | null;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date;
}

export interface UnfinishedRunRow {
  readonly runId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly openedBy: string | null;
  readonly harness: string;
  readonly config: StationConfigParts | null;
  readonly progress: Progress | null;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
}

export interface RanConfig {
  readonly fingerprint: string;
  readonly parts: StationConfigParts;
}

export interface KeyedStation {
  readonly stationId: string;
  readonly stationKey: string;
  readonly stationName: string;
  readonly lineKey: string;
  readonly lineName: string;
}

export interface StationRunsWanted {
  readonly fingerprint: string | null;
  readonly since: Date | null;
  readonly until: Date | null;
  readonly max: number;
  readonly excluding: readonly string[];
}

export interface StationRunRow {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly fingerprint: string | null;
  readonly state: TaskRunState;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
}

interface TracedStationRow {
  readonly stationId: string;
  readonly name: string;
  readonly color: string;
  readonly position: number;
  readonly stations: number;
}

interface TracedTaskRow {
  readonly taskId: string;
  readonly title: string;
  readonly description: string | null;
  readonly stationId: string;
}

export interface TracedRows {
  readonly tasks: readonly TracedTaskRow[];
  readonly stations: readonly TracedStationRow[];
  readonly notes: ReadonlyMap<string, string>;
}

export interface TracedWanted {
  readonly taskIds: readonly string[];
  readonly runIds: readonly string[];
  readonly stationIds: readonly string[];
}

export interface StationRunReaderPort {
  endedRun(runId: string): Promise<EndedRunRow | null>;

  unfinishedOfTeam(teamId: TeamId): Promise<readonly UnfinishedRunRow[]>;

  configsNamed(fingerprints: readonly string[]): Promise<readonly RanConfig[]>;

  stationsKeyed(
    teamId: TeamId,
    stationKey: string,
    lineKey: string | null,
  ): Promise<readonly KeyedStation[]>;

  endedAt(
    stationId: string,
    wanted: StationRunsWanted,
  ): Promise<readonly StationRunRow[]>;

  endedAmong(
    stationId: string,
    runIds: readonly string[],
  ): Promise<readonly StationRunRow[]>;

  journalsOf(runIds: readonly string[]): Promise<readonly RunJournal[]>;

  traced(wanted: TracedWanted): Promise<TracedRows>;
}
