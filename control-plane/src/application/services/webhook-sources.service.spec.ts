import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { describe, expect, it } from 'vitest';

const source = (key: string): WebhookSourcePort => ({
  key,
  happenings: [],
  verifies: () => true,
  delivery: () => 'delivery_1',
  routes: async () => null,
  read: () => [],
});

describe('WebhookSources', () => {
  it('finds a source by the name the world addresses it with', () => {
    const sources = new WebhookSources([source('github'), source('sentry')]);

    expect(sources.find('sentry')?.key).toBe('sentry');
  });

  // A delivery to a source nobody registered is nobody's to act on, and
  // guessing which was meant would act on the wrong host's word.
  it('finds nothing for a source nobody registered', () => {
    expect(new WebhookSources([source('github')]).find('sentry')).toBeNull();
  });

  it('finds nothing for an empty name', () => {
    expect(new WebhookSources([source('github')]).find('')).toBeNull();
  });

  it('holds every source registered', () => {
    const sources = new WebhookSources([source('github'), source('sentry')]);

    expect(sources.all.map((each) => each.key)).toEqual(['github', 'sentry']);
  });
});
