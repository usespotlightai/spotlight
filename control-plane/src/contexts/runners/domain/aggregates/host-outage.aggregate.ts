import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostOutageBegan } from '@runners/domain/events/host-outage-began.event';
import { HostOutageEnded } from '@runners/domain/events/host-outage-ended.event';
import {
  HostOutages,
  type SourceOutage,
} from '@runners/domain/services/host-outages';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly id: HostOutageId;
  readonly workspaceId: WorkspaceId;
  readonly source: CredentialSource;
  // The names of the hosts that went quiet.
  readonly hosts: readonly string[];
  // When Spotlight last heard from one of them.
  readonly since: Date;
  readonly raisedAt: Date;
  readonly version: number;
}

const checked = (state: State): State => {
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

  return state;
};

// The hosts of a pull pool or a trust all stopped reporting in, and Spotlight told the admins. It lasts until a host of the source reports in again, or the source is gone.
export class HostOutage extends EventRecorder {
  private constructor(
    private readonly state: State,
    private readonly ended: boolean,
  ) {
    super();
  }

  static raise(input: {
    id: HostOutageId;
    workspaceId: WorkspaceId;
    outage: SourceOutage;
    sourceKey: string | null;
    at: Date;
  }): HostOutage {
    const raised = new HostOutage(
      checked({
        id: input.id,
        workspaceId: input.workspaceId,
        source: input.outage.source,
        hosts: input.outage.hosts,
        since: input.outage.since,
        raisedAt: input.at,
        version: 0,
      }),
      false,
    );

    raised.record(
      new HostOutageBegan(
        raised.state.id,
        raised.state.workspaceId,
        raised.state.source,
        input.sourceKey,
        raised.state.hosts,
        raised.state.since,
        raised.state.raisedAt,
      ),
    );

    return raised;
  }

  static rehydrate(state: State): HostOutage {
    return new HostOutage(checked(state), false);
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

  get hosts(): readonly string[] {
    return this.state.hosts;
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

  // The outage is over once a host of its source that can take work reports in, or once the pool or trust is gone. Hosts that Spotlight forgot after a day of silence do not end it.
  isOverWith(input: {
    readonly hosts: readonly RunnerHost[];
    readonly sourceExists: boolean;
    readonly now: Date;
  }): boolean {
    return (
      !input.sourceExists ||
      HostOutages.quietOf(input.hosts, input.now) === null
    );
  }

  end(at: Date): HostOutage {
    if (this.ended) {
      return this;
    }

    const ended = new HostOutage(this.state, true);
    ended.inheritEvents(this);
    ended.record(
      new HostOutageEnded(
        this.state.id,
        this.state.workspaceId,
        this.state.source,
        at,
      ),
    );

    return ended;
  }
}
