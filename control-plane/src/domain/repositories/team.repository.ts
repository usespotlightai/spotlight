import type { Team } from '@domain/aggregates/team.aggregate';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamKey } from '@domain/value-objects/team-key.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TeamRepository {
  add(team: Team): Promise<void>;

  save(team: Team): Promise<void>;

  find(id: TeamId): Promise<Team | null>;

  named(workspaceId: WorkspaceId, key: TeamKey): Promise<Team | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Team[]>;

  readingFrom(repository: Repository): Promise<readonly Team[]>;
}
