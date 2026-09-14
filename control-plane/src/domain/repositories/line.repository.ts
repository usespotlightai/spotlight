import type { Line } from '@domain/aggregates/line.aggregate';
import type { LineId } from '@domain/value-objects/line-id.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface LineRepository {
  add(line: Line): Promise<void>;

  save(line: Line): Promise<void>;

  find(id: LineId): Promise<Line | null>;

  holding(stationId: StationId): Promise<Line | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Line[]>;

  ofTeam(teamId: TeamId): Promise<readonly Line[]>;

  withRole(teamId: TeamId, role: LineRole): Promise<Line | null>;
}
