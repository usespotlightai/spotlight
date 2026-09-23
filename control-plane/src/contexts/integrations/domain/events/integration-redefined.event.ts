import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationRedefined implements DomainEvent {
  readonly kind = 'integrations.integration-redefined';

  constructor(
    readonly id: IntegrationDefinitionId,
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly offers: readonly string[],
  ) {}
}
