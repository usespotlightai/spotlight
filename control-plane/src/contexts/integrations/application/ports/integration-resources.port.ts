import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_RESOURCES = Symbol('INTEGRATION_RESOURCES');

export interface IntegrationRecord extends DefinedIntegration {
  readonly teamId: TeamId;
}

export interface IntegrationResourcesPort {
  withId(id: IntegrationDefinitionId): Promise<IntegrationRecord | null>;

  at(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<IntegrationRecord | null>;

  ofTeam(teamId: TeamId): Promise<readonly IntegrationRecord[]>;
}
