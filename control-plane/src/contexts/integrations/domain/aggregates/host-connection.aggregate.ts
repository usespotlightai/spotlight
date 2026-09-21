import { HostConnected } from '@integrations/domain/events/host-connected.event';
import { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const RENEWAL_AHEAD_MS = 5 * 60 * 1000;

interface State {
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly accessToken: AccessToken;
  readonly refreshToken: AccessToken | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
  readonly handle: string | null;
  readonly renewalRefusedAt: Date | null;
  readonly version: number;
}

export class HostConnection extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static linkedFrom(input: {
    teamId: TeamId;
    source: SourceKey;
    grant: HostGrant;
  }): HostConnection {
    const connection = new HostConnection({
      teamId: input.teamId,
      source: input.source,
      accessToken: input.grant.accessToken,
      refreshToken: input.grant.refreshToken,
      expiresAt: input.grant.expiresAt,
      scopes: input.grant.scopes,
      handle: input.grant.handle,
      renewalRefusedAt: null,
      version: 0,
    });

    connection.record(
      new HostConnected(input.teamId, input.source, input.grant.handle),
    );

    return connection;
  }

  static rehydrate(input: State): HostConnection {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'host connection',
        'was kept without a version',
      );
    }

    if (input.renewalRefusedAt !== null && input.refreshToken === null) {
      throw new InconsistentStateError(
        'host connection',
        'had a renewal refused without a way to renew',
      );
    }

    return new HostConnection(input);
  }

  static renewalHorizon(now: Date): Date {
    return new Date(now.getTime() + RENEWAL_AHEAD_MS);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get source(): SourceKey {
    return this.state.source;
  }

  get accessToken(): AccessToken {
    return this.state.accessToken;
  }

  get refreshToken(): AccessToken | null {
    return this.state.refreshToken;
  }

  get expiresAt(): Date | null {
    return this.state.expiresAt;
  }

  get scopes(): readonly string[] {
    return this.state.scopes;
  }

  get handle(): string | null {
    return this.state.handle;
  }

  get renewalRefusedAt(): Date | null {
    return this.state.renewalRefusedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  needsRenewal(now: Date): boolean {
    const { expiresAt, refreshToken, renewalRefusedAt } = this.state;

    if (expiresAt === null || refreshToken === null) {
      return false;
    }

    if (renewalRefusedAt !== null) {
      return false;
    }

    return expiresAt.getTime() < HostConnection.renewalHorizon(now).getTime();
  }

  renewedWith(grant: HostGrant): HostConnection {
    return this.with({
      accessToken: grant.accessToken,
      refreshToken: grant.refreshToken ?? this.state.refreshToken,
      expiresAt: grant.expiresAt,
      scopes: grant.scopes,
      handle: grant.handle ?? this.state.handle,
      renewalRefusedAt: null,
    });
  }

  renewalRefused(at: Date): HostConnection {
    if (this.state.renewalRefusedAt !== null) {
      return this;
    }

    const refused = this.with({ renewalRefusedAt: at });

    refused.record(new HostRenewalRefused(this.teamId, this.source, at));

    return refused;
  }

  equals(other: HostConnection): boolean {
    return this.teamId.equals(other.teamId) && this.source.equals(other.source);
  }

  private with(changes: Partial<State>): HostConnection {
    const next = new HostConnection({ ...this.state, ...changes });

    next.inheritEvents(this);

    return next;
  }
}
