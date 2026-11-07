import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const LINES = Symbol('REPLAYS_LINES');

interface ConfigSourceView {
  readonly repository: Repository;
  readonly path: string;
}

export interface StationView {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly lineKey: string;
  readonly stationId: StationId;
  readonly key: string;
  readonly name: string;
  readonly source: ConfigSourceView | null;
}

export interface StationSettings {
  readonly block: StationBlock;
  readonly threshold: ReplayThreshold | null;
  readonly search: SearchPolicy | null;
  readonly agent: SearchAgent | null;
}

export interface SearchedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly runsAnAgent: boolean;
  readonly placement: {
    readonly labelGroups: readonly (readonly string[])[];
    readonly image: string | null;
  };
}

export interface NamedStation {
  readonly lineKey: string;
  readonly lineName: string;
  readonly key: string;
  readonly name: string;
}

export interface LinesPort {
  station(lineId: LineId, stationId: StationId): Promise<StationView | null>;

  findStation(stationId: StationId): Promise<StationView | null>;

  keyed(lineId: LineId, key: string): Promise<StationView | null>;

  stationSettings(
    lineId: LineId,
    stationId: StationId,
  ): Promise<StationSettings | null>;

  candidateBlock(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null,
  ): Promise<StationBlock | null>;

  namedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<NamedStation | null>;

  searchedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<SearchedStation | null>;
}
