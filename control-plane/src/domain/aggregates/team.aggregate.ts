import { EventRecorder } from '@domain/aggregates/event-recorder';
import { TeamCreated } from '@domain/events/team-created.event';
import { ConfigurationSettledError } from '@domain/exceptions/configuration-settled.error';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
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

export class Team extends EventRecorder {
  private constructor(
    readonly id: TeamId,
    /** Whose it is. A team belongs to one workspace and never moves. */
    readonly workspaceId: WorkspaceId,
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly TeamMember[],
    /** Null where nobody chose, and then the fallback rule applies. */
    readonly configRepository: Repository | null,
  ) {
    super();
  }

  static open(input: {
    workspaceId: WorkspaceId;
    name: TeamName;
    key?: TeamKey;
    owner: UserId;
    newId: () => string;
  }): Team {
    const id = TeamId.of(input.newId());

    const team = new Team(
      id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      [{ userId: input.owner, role: 'owner' }],
      null,
    );

    team.record(new TeamCreated(input.workspaceId, id, input.owner));

    return team;
  }

  static rehydrate(input: {
    id: TeamId;
    workspaceId: WorkspaceId;
    key?: TeamKey;
    name: TeamName;
    members: readonly TeamMember[];
    configRepository?: Repository | null;
  }): Team {
    if (input.members.length === 0) {
      throw new InconsistentStateError('team', 'has no members at all');
    }
    if (!input.members.some((member) => member.role === 'owner')) {
      throw new InconsistentStateError('team', 'has nobody who owns it');
    }

    return new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      input.members,
      input.configRepository ?? null,
    );
  }

  holds(userId: UserId): boolean {
    return this.members.some((each) => each.userId.equals(userId));
  }

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
    );
  }

  renamedTo(name: TeamName): Team {
    return new Team(
      this.id,
      this.workspaceId,
      this.key,
      name,
      this.members,
      this.configRepository,
    );
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }
}
