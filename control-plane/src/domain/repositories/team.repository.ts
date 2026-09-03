import type { Team } from '@domain/aggregates/team.aggregate';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamKey } from '@domain/value-objects/team-key.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TeamRepository {
  add(team: Team): Promise<void>;

  save(team: Team): Promise<void>;

  find(id: TeamId): Promise<Team | null>;

  /** The team a workspace and a key name between them, which is its address. */
  named(workspaceId: WorkspaceId, key: TeamKey): Promise<Team | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Team[]>;

  /**
   * Those that read their configuration from a repository: the ones that
   * pinned it, and the ones that pinned nothing, since one of them may be
   * reading it by the fallback rule.
   */
  readingFrom(repository: Repository): Promise<readonly Team[]>;
}
