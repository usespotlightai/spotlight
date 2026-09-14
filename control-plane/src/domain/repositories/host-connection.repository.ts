import type { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const HOST_CONNECTIONS = Symbol('HOST_CONNECTIONS');

export interface HostConnectionSummary {
  readonly source: string;
  readonly handle: string | null;
  readonly connectedAt: Date;
}

// Tokens are secrets: never hand one to a person; summaries carry none.
export interface HostConnectionRepository {
  of(teamId: TeamId, source: SourceKey): Promise<HostConnection | null>;

  save(connection: HostConnection): Promise<void>;

  held(teamId: TeamId): Promise<readonly HostConnectionSummary[]>;

  nearingExpiry(before: Date): Promise<readonly HostConnection[]>;
}
