import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationSpecRefreshed implements ConfigurationChanged {
  readonly kind = 'integrations.integration-spec-refreshed';

  constructor(
    readonly id: IntegrationDefinitionId,
    readonly teamId: TeamId,
    readonly integration: IntegrationKey,
    readonly tools: readonly string[],
    readonly orphanedTools: readonly string[],
    readonly change: ConfigurationChange,
  ) {}
}
