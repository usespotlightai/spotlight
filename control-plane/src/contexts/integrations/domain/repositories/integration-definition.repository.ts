import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_DEFINITIONS = Symbol('INTEGRATION_DEFINITIONS');

export interface IntegrationDefinitionRepository {
  withId(id: IntegrationDefinitionId): Promise<IntegrationDefinition | null>;

  of(
    teamId: TeamId,
    integration: IntegrationKey,
  ): Promise<IntegrationDefinition | null>;

  ofTeam(teamId: TeamId): Promise<readonly IntegrationDefinition[]>;

  save(definition: IntegrationDefinition): Promise<void>;
}
