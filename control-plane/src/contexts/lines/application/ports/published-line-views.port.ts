import type { LineView } from '@lines/application/contracts/line-view.contract';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PUBLISHED_LINE_VIEWS = Symbol('PUBLISHED_LINE_VIEWS');

export interface PublishedLineViewsPort {
  withId(lineId: LineId): Promise<LineView | null>;

  atStation(stationId: StationId): Promise<LineView | null>;

  ofTeam(teamId: TeamId): Promise<readonly LineView[]>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly LineView[]>;
}
