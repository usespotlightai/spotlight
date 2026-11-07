import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const LINES = Symbol('REPLAYS_LINES');

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
  namedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<NamedStation | null>;

  searchedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<SearchedStation | null>;
}
