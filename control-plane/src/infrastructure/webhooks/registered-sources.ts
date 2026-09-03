import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import { WEBHOOK_SOURCE } from '@infrastructure/webhooks/webhook-source.decorator';
import type { DiscoveryService } from '@nestjs/core';

const marked = (candidate: unknown): boolean =>
  typeof candidate === 'function' &&
  Reflect.getMetadata(WEBHOOK_SOURCE, candidate) === true;

/**
 * The sources the container was given, found by the mark they wear rather
 * than by a list kept beside them. Adding a host is writing one and listing
 * it among the providers; there is no second place to add it to.
 *
 * The mark is looked for on what was built rather than on what the container
 * was told to build with: a source made by a factory is registered under the
 * factory, which wears nothing.
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
