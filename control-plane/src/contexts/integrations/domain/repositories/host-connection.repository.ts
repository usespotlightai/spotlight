import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const HOST_CONNECTIONS = Symbol('HOST_CONNECTIONS');

export interface HostConnectionRepository {
  of(
    teamId: TeamId,
    source: SourceKey,
    holder: ConnectionHolder,
  ): Promise<HostConnection | null>;

  save(connection: HostConnection): Promise<void>;

  remove(connection: HostConnection): Promise<void>;

  expiringBefore(horizon: Date): Promise<readonly HostConnection[]>;

  forgetTeam(teamId: TeamId): Promise<void>;
}
