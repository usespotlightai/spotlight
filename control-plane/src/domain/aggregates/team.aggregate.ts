import { TeamCreated } from '@domain/events/team-created.event';
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
 * A team, and everything that is its own rather than its workspace's: where
 * it reads its configuration from, the hosts it listens to, the lines it
 * runs, and who is on it.
 *
 * A root rather than something inside a workspace, because all of that is
 * addressed by the team and not through the workspace that holds it: a
 * delivery knocks at a team's door, and a reading is a team's reading.
 */
export class Team {
  private constructor(
    readonly id: TeamId,
    /** Whose it is. A team belongs to one workspace and never moves. */
    readonly workspaceId: WorkspaceId,
    /**
     * What it is called where a person writes it down: the directory its
     * configuration sits in, and the door its hosts knock at.
     */
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly TeamMember[],
    /**
     * The repository this team reads its configuration from. Its own: two
     * teams may keep theirs in different places, and one that has not chosen
     * reads from whichever connected repository holds any.
     */
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
      [new TeamCreated(input.workspaceId, id)],
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

  /** Whether this person is on it, or of the workspace that holds it. */
  holds(userId: UserId): boolean {
    return this.members.some((each) => each.userId.equals(userId));
  }

  /**
   * Pins where this team reads its configuration from. Whether the person
   * asking may is the workspace's to say: it is the same kind of change as
   * connecting the workspace to a host.
   */
  keepsConfigurationIn(repository: Repository | null): Team {
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
