import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostOutageBegan } from '@runners/domain/events/host-outage-began.event';
import { HostOutageEnded } from '@runners/domain/events/host-outage-ended.event';
import type { SourceOutage } from '@runners/domain/services/host-outages';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: HostOutageId;
  readonly workspaceId: WorkspaceId;
  readonly source: CredentialSource;
  // When Spotlight last heard from a host of the source.
  readonly since: Date;
  readonly raisedAt: Date;
  readonly ended: boolean;
  readonly version: number;
}

// The hosts of a pull pool or a trust all stopped reporting in, and Spotlight told a person. It lasts until a host of the source reports in again.
export class HostOutage extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static raise(input: {
    id: HostOutageId;
    outage: SourceOutage;
    workspaceId: WorkspaceId;
    sourceKey: string | null;
    at: Date;
  }): HostOutage {
    const raised = new HostOutage({
      id: input.id,
      workspaceId: input.workspaceId,
      source: input.outage.source,
      since: input.outage.since,
      raisedAt: input.at,
      ended: false,
      version: 0,
    });

    raised.record(
      new HostOutageBegan(
        input.id,
        input.workspaceId,
        input.outage.source,
        input.sourceKey,
        input.outage.hosts.map((host: RunnerHost) => host.report.name),
        input.outage.since,
        input.at,
      ),
    );

    return raised;
  }

  static rehydrate(state: Omit<State, 'ended'>): HostOutage {
    if (!Number.isInteger(state.version) || state.version < 0) {
      throw new InconsistentStateError(
        'host outage',
        `has an impossible version (${state.version})`,
      );
    }
    if (state.raisedAt < state.since) {
      throw new InconsistentStateError(
        'host outage',
        'was raised before its hosts went quiet',
      );
    }

    return new HostOutage({ ...state, ended: false });
  }

  get id(): HostOutageId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get source(): CredentialSource {
    return this.state.source;
  }

  get since(): Date {
    return this.state.since;
  }

  get raisedAt(): Date {
    return this.state.raisedAt;
  }

  get version(): number {
    return this.state.version;
  }

  // The outage still holds while its source has no host that reports in: the source is among the outages of the workspace now.
  holdsAmong(outages: readonly SourceOutage[]): boolean {
    return outages.some((each) => each.source.equals(this.state.source));
  }

  end(at: Date): HostOutage {
    if (this.state.ended) {
      return this;
    }

    const ended = new HostOutage({ ...this.state, ended: true });
    ended.inheritEvents(this);
    ended.record(
      new HostOutageEnded(this.state.id, this.state.workspaceId, at),
    );

    return ended;
  }
}
