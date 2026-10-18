import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { ConnectForbiddenError } from '@github/domain/exceptions/connect-forbidden.error';
import { InstallationAlreadyConnectedError } from '@github/domain/exceptions/installation-already-connected.error';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConnectPreconditions {
  readonly isWorkspaceAdmin: boolean;
  readonly isInstallationAdmin: boolean;
  readonly connectedWorkspace: WorkspaceId | null;
}

export class GitHubConnection extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly installation: GitHubInstallation | null,
    readonly version: number,
  ) {
    super();
  }

  static none(workspaceId: WorkspaceId): GitHubConnection {
    return new GitHubConnection(workspaceId, null, 0);
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    installation: GitHubInstallation;
    version: number;
  }): GitHubConnection {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new InconsistentStateError(
        'github connection',
        'was stored without ever being written',
      );
    }

    return new GitHubConnection(
      input.workspaceId,
      input.installation,
      input.version,
    );
  }

  get isConnected(): boolean {
    return this.installation !== null;
  }

  connectTo(
    installation: GitHubInstallation,
    preconditions: ConnectPreconditions,
  ): GitHubConnection {
    if (!preconditions.isWorkspaceAdmin) {
      throw new ConnectForbiddenError('not-workspace-admin');
    }
    if (!preconditions.isInstallationAdmin) {
      throw new ConnectForbiddenError('not-installation-admin');
    }
    if (
      preconditions.connectedWorkspace &&
      !preconditions.connectedWorkspace.equals(this.workspaceId)
    ) {
      throw new InstallationAlreadyConnectedError(installation.value);
    }

    const connected = this.with(installation);
    connected.record(new WorkspaceConnected(this.workspaceId, installation));

    return connected;
  }

  disconnectFrom(installation: GitHubInstallation): GitHubConnection {
    if (!this.installation?.equals(installation)) {
      return this;
    }

    const disconnected = this.with(null);
    disconnected.record(
      new WorkspaceDisconnected(this.workspaceId, installation),
    );

    return disconnected;
  }

  equals(other: GitHubConnection): boolean {
    return this.workspaceId.equals(other.workspaceId);
  }

  private with(installation: GitHubInstallation | null): GitHubConnection {
    const next = new GitHubConnection(
      this.workspaceId,
      installation,
      this.version,
    );
    next.inheritEvents(this);

    return next;
  }
}
