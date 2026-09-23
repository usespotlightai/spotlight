import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_DEFINITIONS = Symbol('INTEGRATION_DEFINITIONS');

export interface IntegrationDefinitionRepository {
  of(teamId: TeamId, source: SourceKey): Promise<IntegrationDefinition | null>;

  save(definition: IntegrationDefinition): Promise<void>;
}
