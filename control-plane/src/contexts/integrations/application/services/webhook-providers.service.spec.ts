import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { describe, expect, it } from 'vitest';

const provider = (key: string): WebhookProviderPort => ({
  key,
  happenings: [],
  verifies: async () => true,
  delivery: () => 'delivery_1',
  routes: async () => null,
  read: async () => [],
});

describe('WebhookProviders', () => {
  it('finds a provider by the name of its integration', () => {
    const providers = WebhookProviders.of([
      provider('github'),
      provider('sentry'),
    ]);

    expect(providers.find('sentry')?.key).toBe('sentry');
  });

  it('finds nothing for a provider nobody registered', () => {
    expect(WebhookProviders.of([provider('github')]).find('sentry')).toBeNull();
  });

  it('finds nothing for an empty name', () => {
    expect(WebhookProviders.of([provider('github')]).find('')).toBeNull();
  });

  it('reads its providers no sooner than it is called itself', () => {
    let reads = 0;
    const providers = new WebhookProviders(() => {
      reads += 1;
      return [provider('github')];
    });

    expect(reads).toBe(0);
    expect(providers.find('github')?.key).toBe('github');
    expect(reads).toBe(1);
  });

  it('reads them once, however often it is called', () => {
    let reads = 0;
    const providers = new WebhookProviders(() => {
      reads += 1;
      return [provider('github')];
    });

    providers.find('github');
    providers.find('github');
    expect(providers.all).toHaveLength(1);
    expect(reads).toBe(1);
  });

  it('contains every provider registered', () => {
    const providers = WebhookProviders.of([
      provider('github'),
      provider('sentry'),
    ]);

    expect(providers.all.map((each) => each.key)).toEqual(['github', 'sentry']);
  });
});
