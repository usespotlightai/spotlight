import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import { WEBHOOK_SOURCE } from '@infrastructure/webhooks/webhook-source.decorator';
import type { DiscoveryService } from '@nestjs/core';

const marked = (candidate: unknown): boolean =>
  typeof candidate === 'function' &&
  Reflect.getMetadata(WEBHOOK_SOURCE, candidate) === true;

/**
 * Found by the mark they wear rather than a list kept beside them, so there
 * is no second place to add a host to.
 *
 * Looked for on what was built rather than what it was built with: a source
 * made by a factory is registered under the factory, which wears nothing.
 */
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
