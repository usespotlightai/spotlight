import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface LineRepository {
  add(line: Line): Promise<void>;

  save(line: Line): Promise<void>;

  find(id: LineId): Promise<Line | null>;

  ofTeam(teamId: TeamId): Promise<readonly Line[]>;

  withDefaultAssignee(
    workspaceId: WorkspaceId,
    emails: readonly string[],
  ): Promise<readonly Line[]>;
}
