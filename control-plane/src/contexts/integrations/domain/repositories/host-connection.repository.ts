import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOST_CONNECTIONS = Symbol('HOST_CONNECTIONS');

export interface HostConnectionRepository {
  of(teamId: TeamId, source: SourceKey): Promise<HostConnection | null>;

  save(connection: HostConnection): Promise<void>;

  expiringBefore(horizon: Date): Promise<readonly HostConnection[]>;
}
