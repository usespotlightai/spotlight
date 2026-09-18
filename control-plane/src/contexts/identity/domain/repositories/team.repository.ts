import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface TeamRepository {
  add(team: Team): Promise<void>;

  save(team: Team): Promise<void>;

  find(id: TeamId): Promise<Team | null>;

  named(workspaceId: WorkspaceId, key: TeamKey): Promise<Team | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Team[]>;
}
