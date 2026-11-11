import type { ConfiguredWebhookProvidersPort } from '@integrations/application/ports/configured-webhook-providers.port';
import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import type { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import type { DeliveryAddressee } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { DeliveryProviders } from '@integrations/domain/services/delivery-providers';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';

export interface Addressed {
  readonly integration: IntegrationKey;
  readonly to: DeliveryAddressee | null;
}

export class ProviderForDelivery {
  constructor(
    private readonly registered: WebhookProviders,
    private readonly configured: ConfiguredWebhookProvidersPort,
  ) {}

  async find(addressed: Addressed): Promise<WebhookProviderPort | null> {
    const { to } = addressed;
    const builtIn = this.registered.find(addressed.integration);
    const owner = DeliveryProviders.ownerOf({
      addressedToTeam: to !== null,
      builtIn: builtIn !== null,
    });

    if (owner === 'built-in') {
      return builtIn;
    }

    if (owner === 'nobody' || to === null) {
      return null;
    }

    return this.configured.find(
      {
        workspaceId: to.workspaceId,
        teamId: to.teamId,
        teamKey: to.teamKey,
      },
      addressed.integration,
    );
  }
}
