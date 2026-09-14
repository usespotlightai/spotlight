import { EventRecorder } from '@domain/aggregates/event-recorder';
import { ConfigurationMoveStarted } from '@domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@domain/events/configuration-moved.event';
import { TeamCreated } from '@domain/events/team-created.event';
import { TeamMemberJoined } from '@domain/events/team-member-joined.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InvalidConfigurationMoveError } from '@domain/exceptions/invalid-configuration-move.error';
import type { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import type { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface TeamMember {
  readonly userId: UserId;
  readonly role: TeamRole;
}

export class Team extends EventRecorder {
  private constructor(
    readonly id: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly TeamMember[],
    readonly configRepository: Repository | null,
    readonly movingConfigurationTo: Repository | null,
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
      [{ userId: input.owner, role: TeamRole.owner }],
      null,
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
    movingConfigurationTo?: Repository | null;
  }): Team {
    if (input.members.length === 0) {
      throw new InconsistentStateError('team', 'has no members at all');
    }
    if (!input.members.some((member) => member.role.isOwner)) {
      throw new InconsistentStateError('team', 'has nobody who owns it');
    }
    if (
      input.movingConfigurationTo &&
      input.configRepository?.equals(input.movingConfigurationTo)
    ) {
      throw new InconsistentStateError(
        'team',
        'is moving its configuration to where it already keeps it',
      );
    }

    return new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      input.members,
      input.configRepository ?? null,
      input.movingConfigurationTo ?? null,
    );
  }

  holds(userId: UserId): boolean {
    return this.members.some((each) => each.userId.equals(userId));
  }

  joinedBy(userId: UserId, role: TeamRole): Team {
    if (this.holds(userId)) {
      return this;
    }

    const joined = this.reshaped({
      members: [...this.members, { userId, role }],
    });

    joined.record(new TeamMemberJoined(this.id, userId, role));

    return joined;
  }

  configurationReadFrom(lastRead: Repository | null): Repository | null {
    return this.configRepository ?? lastRead;
  }

  configurationWrittenTo(lastRead: Repository | null): Repository | null {
    return this.movingConfigurationTo ?? this.configurationReadFrom(lastRead);
  }

  keepsConfigurationIn(repository: Repository | null): Team {
    return this.reshaped({
      configRepository: repository,
      movingConfigurationTo: null,
    });
  }

  movesConfigurationTo(
    destination: Repository,
    lastRead: Repository | null,
  ): Team {
    if (this.configurationReadFrom(lastRead)?.equals(destination)) {
      throw new InvalidConfigurationMoveError(
        `already reads its configuration from ${destination.value}`,
      );
    }

    if (this.movingConfigurationTo?.equals(destination)) {
      return this;
    }

    const moving = this.reshaped({ movingConfigurationTo: destination });
    moving.record(
      new ConfigurationMoveStarted(this.workspaceId, this.id, destination),
    );

    return moving;
  }

  finishesMovingConfiguration(): Team {
    const destination = this.movingConfigurationTo;

    if (!destination) {
      throw new InvalidConfigurationMoveError(
        'has no move of its configuration under way',
      );
    }

    const moved = this.reshaped({
      configRepository: destination,
      movingConfigurationTo: null,
    });
    moved.record(
      new ConfigurationMoved(
        this.workspaceId,
        this.id,
        this.configRepository,
        destination,
      ),
    );

    return moved;
  }

  renamedTo(name: TeamName): Team {
    return this.reshaped({ name });
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }

  private reshaped(
    over: Partial<
      Pick<
        Team,
        'name' | 'members' | 'configRepository' | 'movingConfigurationTo'
      >
    >,
  ): Team {
    const next = new Team(
      this.id,
      this.workspaceId,
      this.key,
      over.name ?? this.name,
      over.members ?? this.members,
      over.configRepository !== undefined
        ? over.configRepository
        : this.configRepository,
      over.movingConfigurationTo !== undefined
        ? over.movingConfigurationTo
        : this.movingConfigurationTo,
    );
    next.inheritEvents(this);

    return next;
  }
}
