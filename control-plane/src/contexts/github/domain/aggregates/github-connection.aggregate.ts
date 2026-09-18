import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { InstallationClaimedError } from '@github/domain/exceptions/installation-claimed.error';
import { NotYoursToConnectError } from '@github/domain/exceptions/not-yours-to-connect.error';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ConnectingFacts {
  readonly workspaceAdministered: boolean;
  readonly installationAdministered: boolean;
  readonly claimedBy: WorkspaceId | null;
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

  connectedTo(
    installation: GitHubInstallation,
    facts: ConnectingFacts,
  ): GitHubConnection {
    if (!facts.workspaceAdministered) {
      throw new NotYoursToConnectError('workspace-not-administered');
    }
    if (!facts.installationAdministered) {
      throw new NotYoursToConnectError('installation-not-administered');
    }
    if (facts.claimedBy && !facts.claimedBy.equals(this.workspaceId)) {
      throw new InstallationClaimedError(installation.value);
    }

    const connected = this.with(installation);
    connected.record(new WorkspaceConnected(this.workspaceId, installation));

    return connected;
  }

  disconnectedFrom(installation: GitHubInstallation): GitHubConnection {
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
