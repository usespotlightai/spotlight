import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import { WEBHOOK_PROVIDER } from '@integrations/infrastructure/webhooks/webhook-provider.decorator';
import type { DiscoveryService } from '@nestjs/core';

const marked = (candidate: unknown): boolean =>
  typeof candidate === 'function' &&
  Reflect.getMetadata(WEBHOOK_PROVIDER, candidate) === true;

// Also checks metatype, because Nest registers factory-built providers under the factory.
export const markedProviders = (
  discovery: DiscoveryService,
): readonly WebhookProviderPort[] =>
  discovery
    .getProviders()
    .filter(
      (wrapper) =>
        wrapper.instance &&
        (marked(wrapper.instance.constructor) || marked(wrapper.metatype)),
    )
    .map((wrapper) => wrapper.instance as WebhookProviderPort);
