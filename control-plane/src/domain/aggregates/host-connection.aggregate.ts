import { EventRecorder } from '@domain/aggregates/event-recorder';
import { HostConnected } from '@domain/events/host-connected.event';
import type { HostGrant } from '@domain/value-objects/host-grant.vo';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * A team's standing link to one host: the token it acts with, the token it gets
 * the next one by, when the first goes stale, what it was granted, and the name
 * the host knows the team by. Identified by the team and the source together —
 * one team, one link per host.
 *
 * This is where the life of a connection lives: whether a token is near enough
 * to expiry to be worth renewing, and what a renewal keeps of the old link when
 * the host is sparing with what it reissues. The tokens are secrets to whoever
 * saves them; that they are sealed at rest is the repository's to know, not this.
 */
export class HostConnection extends EventRecorder {
  private constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly accessToken: string,
    readonly refreshToken: string | null,
    readonly expiresAt: Date | null,
    readonly scopes: readonly string[],
    /** What the host calls the team; null where it never said. */
    readonly handle: string | null,
  ) {
    super();
  }

  /**
   * Made when a team first authorizes a host, or authorizes it afresh. Worth
   * announcing, so what follows from a team reaching a new host is free to
   * happen elsewhere.
   */
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

  /** Read back from where it was kept, which is not a thing that happened. */
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

  /**
   * Whether the token is near enough to expiry to renew now rather than risk on
   * the next call. A connection with no expiry never is; one with no way to
   * renew is not worth calling near, since nearness would change nothing.
   */
  isExpiring(now: Date, within: number): boolean {
    if (this.expiresAt === null || this.refreshToken === null) {
      return false;
    }

    return this.expiresAt.getTime() - now.getTime() < within;
  }

  /**
   * The connection after a renewal. A host sparing with what it reissues keeps
   * what it gave before: the refresh token that is still good, and the name it
   * already told us. Renewing is not a thing that happened to announce — it is
   * the same link, kept alive.
   */
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
