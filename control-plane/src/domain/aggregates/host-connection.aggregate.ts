import { EventRecorder } from '@domain/aggregates/event-recorder';
import { HostConnected } from '@domain/events/host-connected.event';
import type { HostGrant } from '@domain/value-objects/host-grant.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export class HostConnection extends EventRecorder {
  private constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly accessToken: string,
    readonly refreshToken: string | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly string[],
    readonly handle: string | null,
  ) {
    super();
  }

  static linkedFrom(input: {
    teamId: TeamId;
    source: SourceKey;
    grant: HostGrant;
  }): HostConnection {
    const connection = HostConnection.fromGrant(
      input.teamId,
      input.source,
      input.grant,
    );

    connection.record(new HostConnected(input.teamId, input.source));

    return connection;
  }

  static rehydrate(input: {
    teamId: TeamId;
    source: SourceKey;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: readonly string[];
    handle: string | null;
  }): HostConnection {
    return new HostConnection(
      input.teamId,
      input.source,
      input.accessToken,
      input.refreshToken,
      input.expiresAt,
      input.scopes,
      input.handle,
    );
  }

  isExpiring(now: Date, within: number): boolean {
    if (this.expiresAt === null || this.refreshToken === null) {
      return false;
    }

    return this.expiresAt.getTime() - now.getTime() < within;
  }

  renewedWith(grant: HostGrant): HostConnection {
    return new HostConnection(
      this.teamId,
      this.source,
      grant.accessToken,
      grant.refreshToken ?? this.refreshToken,
      grant.expiresAt,
      grant.scopes,
      grant.handle ?? this.handle,
    );
  }

  private static fromGrant(
    teamId: TeamId,
    source: SourceKey,
    grant: HostGrant,
  ): HostConnection {
    return new HostConnection(
      teamId,
      source,
      grant.accessToken,
      grant.refreshToken,
      grant.expiresAt,
      grant.scopes,
      grant.handle,
    );
  }

  equals(other: HostConnection): boolean {
    return this.teamId.equals(other.teamId) && this.source.equals(other.source);
  }
}
