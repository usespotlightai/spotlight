import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { RunState } from '@work/domain/value-objects/run-state';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';

export const STATION_RUN_READER = Symbol('STATION_RUN_READER');

export interface EndedRunRow {
  readonly runId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly earlier: readonly RunState[];
  readonly harness: string;
  readonly config: StationConfigParts | null;
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
  readonly state: RunState;
  readonly stopRequested: boolean;
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
  readonly state: RunState;
  readonly attempt: number;
  readonly harness: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
}

export interface StationAlertRowShape {
  readonly measure: string;
  readonly risesBy: number | null;
  readonly above: number | null;
  readonly fallsBy: number | null;
  readonly below: number | null;
  readonly over: number;
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

  alertsAt(stationId: string): Promise<readonly StationAlertRowShape[] | null>;

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
