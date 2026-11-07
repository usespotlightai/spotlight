import { IntegrationConnected } from '@integrations/domain/events/integration-connected.event';
import { RefreshClaimedError } from '@integrations/domain/exceptions/refresh-claimed.error';
import { isUsableConnection } from '@integrations/domain/services/integration-connection-status';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OAuthScope } from '@integrations/domain/value-objects/oauth-scope.vo';
import type { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { RefreshClaim } from '@integrations/domain/value-objects/refresh-claim.vo';
import type { RefreshToken } from '@integrations/domain/value-objects/refresh-token.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const REFRESH_AHEAD_MS = 5 * 60 * 1000;

const REFRESH_LEASE_MS = 30_000;

interface State {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
  readonly owner: ConnectionOwner;
  readonly accessToken: AccessToken;
  readonly refreshToken: RefreshToken | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly OAuthScope[];
  readonly linkedAccount: string | null;
  readonly refreshFailedAt: Date | null;
  readonly refreshClaim: RefreshClaim | null;
  readonly connectedAt: Date;
  readonly version: number;
}

export class IntegrationConnection extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static connectFrom(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    integration: IntegrationKey;
    owner: ConnectionOwner;
    tokens: OAuthTokens;
    at: Date;
  }): IntegrationConnection {
    const connection = new IntegrationConnection({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      integration: input.integration,
      owner: input.owner,
      accessToken: input.tokens.accessToken,
      refreshToken: input.tokens.refreshToken,
      expiresAt: input.tokens.expiresAt,
      scopes: input.tokens.scopes,
      linkedAccount: input.tokens.linkedAccount,
      refreshFailedAt: null,
      refreshClaim: null,
      connectedAt: input.at,
      version: 0,
    });

    connection.record(connection.connected());

    return connection;
  }

  static rehydrate(input: State): IntegrationConnection {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'integration connection',
        'was stored without a version',
      );
    }

    if (input.refreshFailedAt !== null && input.refreshToken === null) {
      throw new InconsistentStateError(
        'integration connection',
        'had a failed refresh without a refresh token',
      );
    }

    if (input.refreshClaim !== null && input.refreshToken === null) {
      throw new InconsistentStateError(
        'integration connection',
        'was claimed for refresh without a refresh token',
      );
    }

    return new IntegrationConnection(input);
  }

  static refreshHorizon(now: Date): Date {
    return new Date(now.getTime() + REFRESH_AHEAD_MS);
  }

  static get refreshLeaseMs(): number {
    return REFRESH_LEASE_MS;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get owner(): ConnectionOwner {
    return this.state.owner;
  }

  get accessToken(): AccessToken {
    return this.state.accessToken;
  }

  get refreshToken(): RefreshToken | null {
    return this.state.refreshToken;
  }

  get expiresAt(): Date | null {
    return this.state.expiresAt;
  }

  get scopes(): readonly OAuthScope[] {
    return this.state.scopes;
  }

  get linkedAccount(): string | null {
    return this.state.linkedAccount;
  }

  get refreshFailedAt(): Date | null {
    return this.state.refreshFailedAt;
  }

  get refreshClaim(): RefreshClaim | null {
    return this.state.refreshClaim;
  }

  get connectedAt(): Date {
    return this.state.connectedAt;
  }

  get usable(): boolean {
    return isUsableConnection(this.state);
  }

  get refreshable(): boolean {
    return this.state.refreshToken !== null && this.usable;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  needsRefresh(now: Date): boolean {
    const { expiresAt, refreshToken, refreshFailedAt } = this.state;

    if (expiresAt === null || refreshToken === null) {
      return false;
    }

    if (refreshFailedAt !== null || this.isClaimedAt(now)) {
      return false;
    }

    return (
      expiresAt.getTime() < IntegrationConnection.refreshHorizon(now).getTime()
    );
  }

  isClaimedAt(now: Date): boolean {
    return this.state.refreshClaim?.isActiveAt(now) ?? false;
  }

  hasToken(token: AccessToken): boolean {
    return this.state.accessToken.equals(token);
  }

  refreshesWith(token: RefreshToken): boolean {
    return this.state.refreshToken?.equals(token) ?? false;
  }

  reconnectedWith(tokens: OAuthTokens, at: Date): IntegrationConnection {
    const reconnected = this.with({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      linkedAccount: tokens.linkedAccount,
      refreshFailedAt: null,
      refreshClaim: null,
      connectedAt: at,
    });

    reconnected.record(reconnected.connected());

    return reconnected;
  }

  claimRefresh(now: Date): IntegrationConnection {
    if (!this.refreshable) {
      throw new InconsistentStateError(
        'integration connection',
        'cannot be refreshed, so it cannot be claimed for refresh',
      );
    }

    if (this.isClaimedAt(now)) {
      throw new RefreshClaimedError(this.integration.value);
    }

    return this.with({
      refreshClaim: RefreshClaim.from(now, REFRESH_LEASE_MS),
    });
  }

  refreshReleased(): IntegrationConnection {
    return this.state.refreshClaim === null
      ? this
      : this.with({ refreshClaim: null });
  }

  refreshedWith(tokens: OAuthTokens): IntegrationConnection {
    return this.with({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? this.state.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      linkedAccount: tokens.linkedAccount ?? this.state.linkedAccount,
      refreshFailedAt: null,
      refreshClaim: null,
    });
  }

  refreshFailed(at: Date): IntegrationConnection {
    if (this.state.refreshFailedAt !== null) {
      return this.refreshReleased();
    }

    return this.with({ refreshFailedAt: at, refreshClaim: null });
  }

  equals(other: IntegrationConnection): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.integration.equals(other.integration) &&
      this.owner.equals(other.owner)
    );
  }

  private connected(): IntegrationConnected {
    return new IntegrationConnected(
      this.workspaceId,
      this.teamId,
      this.integration,
      this.owner,
      this.linkedAccount,
    );
  }

  private with(changes: Partial<State>): IntegrationConnection {
    const next = new IntegrationConnection({ ...this.state, ...changes });

    next.inheritEvents(this);

    return next;
  }
}
