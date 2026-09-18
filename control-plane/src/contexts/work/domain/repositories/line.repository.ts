import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineRole } from '@work/domain/value-objects/line-role.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export interface LineRepository {
  add(line: Line): Promise<void>;

  save(line: Line): Promise<void>;

  find(id: LineId): Promise<Line | null>;

  holding(stationId: StationId): Promise<Line | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Line[]>;

  ofTeam(teamId: TeamId): Promise<readonly Line[]>;

  withRole(teamId: TeamId, role: LineRole): Promise<Line | null>;
}
