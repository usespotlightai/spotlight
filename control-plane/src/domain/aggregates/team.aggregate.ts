import { TeamCreated } from '@domain/events/team-created.event';
import { ConfigurationSettledError } from '@domain/exceptions/configuration-settled.error';
import type { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import type { TeamName } from '@domain/value-objects/team-name.vo';
import type { TeamRole } from '@domain/value-objects/team-role';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TeamMember {
  readonly userId: UserId;
  readonly role: TeamRole;
}

/**
 * A root rather than something inside a workspace: a delivery knocks at a
 * team's door, and a reading is a team's reading.
 */
export class Team {
  private constructor(
    readonly id: TeamId,
    /** Whose it is. A team belongs to one workspace and never moves. */
    readonly workspaceId: WorkspaceId,
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly TeamMember[],
    /** Null where nobody chose, and then the fallback rule applies. */
    readonly configRepository: Repository | null,
    readonly happened: readonly TeamCreated[],
  ) {}

  static open(input: {
    workspaceId: WorkspaceId;
    name: TeamName;
    key?: TeamKey;
    owner: UserId;
    newId: () => string;
  }): Team {
    const id = TeamId.of(input.newId());

    return new Team(
      id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      [{ userId: input.owner, role: 'owner' }],
      null,
      [new TeamCreated(input.workspaceId, id, input.owner)],
    );
  }

  static rehydrate(input: {
    id: TeamId;
    workspaceId: WorkspaceId;
    key?: TeamKey;
    name: TeamName;
    members: readonly TeamMember[];
    configRepository?: Repository | null;
  }): Team {
    return new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      input.members,
      input.configRepository ?? null,
      [],
    );
  }

  holds(userId: UserId): boolean {
    return this.members.some((each) => each.userId.equals(userId));
  }

  /** Who may is the workspace's to say. */
  /**
   * Said once. Moving it would leave every file already written behind and
   * start reading someone else's from then on, so a team that has somewhere
   * keeps it; saying the same place again is not a change.
   */
  keepsConfigurationIn(repository: Repository | null): Team {
    const held = this.configRepository;

    if (held && !(repository && held.equals(repository))) {
      throw new ConfigurationSettledError(held.value);
    }

    return new Team(
      this.id,
      this.workspaceId,
      this.key,
      this.name,
      this.members,
      repository,
      this.happened,
    );
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }
}
