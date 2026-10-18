import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_CONNECTIONS = Symbol('INTEGRATION_CONNECTIONS');

export interface IntegrationConnectionRepository {
  of(
    teamId: TeamId,
    integration: IntegrationKey,
    owner: ConnectionOwner,
  ): Promise<IntegrationConnection | null>;

  save(connection: IntegrationConnection): Promise<void>;

  remove(connection: IntegrationConnection): Promise<void>;

  expiringBefore(horizon: Date): Promise<readonly IntegrationConnection[]>;

  deleteForTeam(teamId: TeamId): Promise<void>;
}
