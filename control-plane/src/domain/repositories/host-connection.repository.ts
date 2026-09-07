import type { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const HOST_CONNECTIONS = Symbol('HOST_CONNECTIONS');

/** A connection as anybody is ever shown it: which host, and its name for us. */
export interface HostConnectionSummary {
  readonly source: string;
  readonly handle: string | null;
  readonly connectedAt: Date;
}

/**
 * Where a team's standing links to hosts are kept. The tokens a connection
 * holds are secrets: they go in from the connect flow and are read only to act
 * as the team, and nothing here gives one back to a person. Summaries carry no
 * token, so saying which hosts a team has linked never opens one.
 */
export interface HostConnectionRepository {
  of(teamId: TeamId, source: SourceKey): Promise<HostConnection | null>;

  save(connection: HostConnection): Promise<void>;

  /** What a person may see: which hosts a team has linked, never the tokens. */
  held(teamId: TeamId): Promise<readonly HostConnectionSummary[]>;

  /**
   * Every connection whose token is near its end and can be renewed, across all
   * teams, so a keeper can renew them before they are next needed.
   */
  nearingExpiry(before: Date): Promise<readonly HostConnection[]>;
}
