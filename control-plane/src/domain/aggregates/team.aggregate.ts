import { EventRecorder } from '@domain/aggregates/event-recorder';
import { ConfigurationMoveStarted } from '@domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@domain/events/configuration-moved.event';
import { TeamCreated } from '@domain/events/team-created.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { InvalidConfigurationMoveError } from '@domain/exceptions/invalid-configuration-move.error';
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
    /**
     * Where its configuration is on its way to, with a pull request carrying it
     * open there. Null where nothing is moving. Reading stays where it is until
     * the move lands, so a pull request nobody has merged changes nothing.
     */
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
      [{ userId: input.owner, role: 'owner' }],
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
    if (!input.members.some((member) => member.role === 'owner')) {
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

  /**
   * Where it reads its configuration from: where it keeps it, or else wherever
   * the fallback rule last found it.
   */
  configurationReadFrom(lastRead: Repository | null): Repository | null {
    return this.configRepository ?? lastRead;
  }

  /**
   * Where a change to its configuration is written. While a move is under way
   * that is where it is going, so an edit made meanwhile lands in the pull
   * request carrying it rather than somewhere about to be left behind.
   */
  configurationWrittenTo(lastRead: Repository | null): Repository | null {
    return this.movingConfigurationTo ?? this.configurationReadFrom(lastRead);
  }

  /**
   * Where a team keeps its configuration, said outright. Said with another
   * place, or with none, moves it without carrying anything: the files already
   * written stay in the old repository, and reading begins from the new. A move
   * under way is given up, since this choice is made over it. Saying the same
   * place again is no change.
   */
  keepsConfigurationIn(repository: Repository | null): Team {
    return this.reshaped({
      configRepository: repository,
      movingConfigurationTo: null,
    });
  }

  /** Starting the same move again is no change. */
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

  /** What was recorded before a change is still owed after it. */
  private reshaped(
    over: Partial<
      Pick<Team, 'name' | 'configRepository' | 'movingConfigurationTo'>
    >,
  ): Team {
    const next = new Team(
      this.id,
      this.workspaceId,
      this.key,
      over.name ?? this.name,
      this.members,
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
