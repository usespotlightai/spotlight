import { HostConnected } from '@integrations/domain/events/host-connected.event';
import { HostDisconnected } from '@integrations/domain/events/host-disconnected.event';
import { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
import { RenewalClaimedError } from '@integrations/domain/exceptions/renewal-claimed.error';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { RenewalClaim } from '@integrations/domain/value-objects/renewal-claim.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const RENEWAL_AHEAD_MS = 5 * 60 * 1000;

interface State {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly holder: ConnectionHolder;
  readonly accessToken: AccessToken;
  readonly refreshToken: AccessToken | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
  readonly handle: string | null;
  readonly renewalRefusedAt: Date | null;
  readonly renewalClaim: RenewalClaim | null;
  readonly version: number;
}

export class HostConnection extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static linkedFrom(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    source: SourceKey;
    holder: ConnectionHolder;
    grant: HostGrant;
  }): HostConnection {
    const connection = new HostConnection({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      source: input.source,
      holder: input.holder,
      accessToken: input.grant.accessToken,
      refreshToken: input.grant.refreshToken,
      expiresAt: input.grant.expiresAt,
      scopes: input.grant.scopes,
      handle: input.grant.handle,
      renewalRefusedAt: null,
      renewalClaim: null,
      version: 0,
    });

    connection.record(
      new HostConnected(
        input.workspaceId,
        input.teamId,
        input.source,
        input.holder,
        input.grant.handle,
      ),
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

    if (input.renewalClaim !== null && input.refreshToken === null) {
      throw new InconsistentStateError(
        'host connection',
        'was claimed for renewal without a way to renew',
      );
    }

    return new HostConnection(input);
  }

  static renewalHorizon(now: Date): Date {
    return new Date(now.getTime() + RENEWAL_AHEAD_MS);
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get source(): SourceKey {
    return this.state.source;
  }

  get holder(): ConnectionHolder {
    return this.state.holder;
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

  get renewalClaim(): RenewalClaim | null {
    return this.state.renewalClaim;
  }

  get usable(): boolean {
    return this.state.renewalRefusedAt === null;
  }

  get renewable(): boolean {
    return this.state.refreshToken !== null && this.usable;
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

    if (renewalRefusedAt !== null || this.isClaimedAt(now)) {
      return false;
    }

    return expiresAt.getTime() < HostConnection.renewalHorizon(now).getTime();
  }

  isClaimedAt(now: Date): boolean {
    return this.state.renewalClaim?.heldAt(now) ?? false;
  }

  refusedToken(token: AccessToken): boolean {
    return this.state.accessToken.equals(token);
  }

  claimRenewal(now: Date, leaseMs: number): HostConnection {
    if (!this.renewable) {
      throw new InconsistentStateError(
        'host connection',
        'cannot be renewed, so it cannot be claimed for renewal',
      );
    }

    if (this.isClaimedAt(now)) {
      throw new RenewalClaimedError(this.source.value);
    }

    return this.with({ renewalClaim: RenewalClaim.from(now, leaseMs) });
  }

  renewalReleased(): HostConnection {
    return this.state.renewalClaim === null
      ? this
      : this.with({ renewalClaim: null });
  }

  renewedWith(grant: HostGrant): HostConnection {
    return this.with({
      accessToken: grant.accessToken,
      refreshToken: grant.refreshToken ?? this.state.refreshToken,
      expiresAt: grant.expiresAt,
      scopes: grant.scopes,
      handle: grant.handle ?? this.state.handle,
      renewalRefusedAt: null,
      renewalClaim: null,
    });
  }

  renewalRefused(at: Date): HostConnection {
    if (this.state.renewalRefusedAt !== null) {
      return this.renewalReleased();
    }

    const refused = this.with({ renewalRefusedAt: at, renewalClaim: null });

    refused.record(
      new HostRenewalRefused(this.teamId, this.source, this.holder, at),
    );

    return refused;
  }

  disconnected(): HostConnection {
    const gone = this.with({});

    gone.record(new HostDisconnected(this.teamId, this.source, this.holder));

    return gone;
  }

  equals(other: HostConnection): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.source.equals(other.source) &&
      this.holder.equals(other.holder)
    );
  }

  private with(changes: Partial<State>): HostConnection {
    const next = new HostConnection({ ...this.state, ...changes });

    next.inheritEvents(this);

    return next;
  }
}
