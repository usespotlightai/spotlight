import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import { WEBHOOK_SOURCE } from '@integrations/infrastructure/webhooks/webhook-source.decorator';
import type { DiscoveryService } from '@nestjs/core';

const marked = (candidate: unknown): boolean =>
  typeof candidate === 'function' &&
  Reflect.getMetadata(WEBHOOK_SOURCE, candidate) === true;

// Also checks metatype, because Nest registers factory-built providers under the factory.
export const markedSources = (
  discovery: DiscoveryService,
): readonly WebhookSourcePort[] =>
  discovery
    .getProviders()
    .filter(
      (wrapper) =>
        wrapper.instance &&
        (marked(wrapper.instance.constructor) || marked(wrapper.metatype)),
    )
    .map((wrapper) => wrapper.instance as WebhookSourcePort);
