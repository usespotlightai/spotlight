import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationUpdated implements ConfigurationChanged {
  readonly kind = 'integrations.integration-updated';

  constructor(
    readonly id: IntegrationDefinitionId,
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly offers: readonly string[],
    readonly change: ConfigurationChange,
  ) {}
}
