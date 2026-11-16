import type { ActiveConnection } from '@integrations/application/ports/integration-runtime.port';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_CONNECTIONS = Symbol('TEAM_CONNECTIONS');

export interface TeamConnectionsPort {
  activeOf(
    teamId: TeamId,
    integration: Integration,
  ): Promise<ActiveConnection | null>;
}
