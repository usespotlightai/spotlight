import type { ConfiguredWebhookProvidersPort } from '@integrations/application/ports/configured-webhook-providers.port';
import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import type { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import type { DeliveryAddressee } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface Addressed {
  readonly integration: string;
  readonly to: DeliveryAddressee | null;
}

export class ProviderForDelivery {
  constructor(
    private readonly registered: WebhookProviders,
    private readonly configured: ConfiguredWebhookProvidersPort,
  ) {}

  async find(addressed: Addressed): Promise<WebhookProviderPort | null> {
    const { to } = addressed;

    if (to === null) {
      return this.registered.find(addressed.integration);
    }

    // Built-in providers have priority, so a team file cannot take the deliveries of a built-in provider.
    if (this.registered.find(addressed.integration)) {
      return null;
    }

    return this.configured.find(
      {
        workspaceId: WorkspaceId.of(to.workspaceId),
        teamId: TeamId.of(to.teamId),
        teamKey: to.teamKey,
      },
      addressed.integration,
    );
  }
}
