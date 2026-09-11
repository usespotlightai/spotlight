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
   * Those a push to a repository is news for: the ones that keep their
   * configuration there, the ones moving it there (whose move may have
   * landed), and the ones that keep it nowhere, since one of them may be
   * reading it by the fallback rule.
   */
  readingFrom(repository: Repository): Promise<readonly Team[]>;
}
