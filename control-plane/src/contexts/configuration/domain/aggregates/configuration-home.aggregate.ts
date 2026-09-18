import { ConfigurationMoveStarted } from '@configuration/domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@configuration/domain/events/configuration-moved.event';
import { ConfigurationPinned } from '@configuration/domain/events/configuration-pinned.event';
import { InvalidConfigurationMoveError } from '@configuration/domain/exceptions/invalid-configuration-move.error';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigurationHome extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly keptIn: Repository | null,
    readonly movingTo: Repository | null,
    readonly version: number,
  ) {
    super();
  }

  static unpinned(workspaceId: WorkspaceId, teamId: TeamId): ConfigurationHome {
    return new ConfigurationHome(workspaceId, teamId, null, null, 0);
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    keptIn: Repository | null;
    movingTo: Repository | null;
    version: number;
  }): ConfigurationHome {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'configuration home',
        'was kept without ever being written',
      );
    }

    if (input.movingTo && input.keptIn?.equals(input.movingTo)) {
      throw new InconsistentStateError(
        'configuration home',
        'is moving to where the configuration is already kept',
      );
    }

    return new ConfigurationHome(
      input.workspaceId,
      input.teamId,
      input.keptIn,
      input.movingTo,
      input.version,
    );
  }

  get isNew(): boolean {
    return this.version === 0;
  }

  readFrom(lastRead: Repository | null): Repository | null {
    return this.keptIn ?? lastRead;
  }

  writtenTo(lastRead: Repository | null): Repository | null {
    return this.movingTo ?? this.readFrom(lastRead);
  }

  listensTo(repository: Repository): boolean {
    return (
      this.keptIn === null ||
      this.keptIn.equals(repository) ||
      (this.movingTo?.equals(repository) ?? false)
    );
  }

  keptInto(repository: Repository | null): ConfigurationHome {
    const pinned = this.reshaped({ keptIn: repository, movingTo: null });
    pinned.record(
      new ConfigurationPinned(this.workspaceId, this.teamId, repository),
    );

    return pinned;
  }

  movesTo(
    destination: Repository,
    lastRead: Repository | null,
  ): ConfigurationHome {
    if (this.readFrom(lastRead)?.equals(destination)) {
      throw new InvalidConfigurationMoveError(
        `already reads its configuration from ${destination.value}`,
      );
    }

    if (this.movingTo?.equals(destination)) {
      return this;
    }

    const moving = this.reshaped({ movingTo: destination });
    moving.record(
      new ConfigurationMoveStarted(this.workspaceId, this.teamId, destination),
    );

    return moving;
  }

  finishesMoving(): ConfigurationHome {
    const destination = this.movingTo;

    if (!destination) {
      throw new InvalidConfigurationMoveError(
        'has no move of its configuration under way',
      );
    }

    const moved = this.reshaped({ keptIn: destination, movingTo: null });
    moved.record(
      new ConfigurationMoved(
        this.workspaceId,
        this.teamId,
        this.keptIn,
        destination,
      ),
    );

    return moved;
  }

  equals(other: ConfigurationHome): boolean {
    return this.teamId.equals(other.teamId);
  }

  private reshaped(
    over: Partial<Pick<ConfigurationHome, 'keptIn' | 'movingTo'>>,
  ): ConfigurationHome {
    const next = new ConfigurationHome(
      this.workspaceId,
      this.teamId,
      over.keptIn !== undefined ? over.keptIn : this.keptIn,
      over.movingTo !== undefined ? over.movingTo : this.movingTo,
      this.version,
    );
    next.inheritEvents(this);

    return next;
  }
}
