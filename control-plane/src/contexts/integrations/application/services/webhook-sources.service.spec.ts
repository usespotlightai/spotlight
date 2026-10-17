import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { describe, expect, it } from 'vitest';

const source = (key: string): WebhookSourcePort => ({
  key,
  happenings: [],
  verifies: async () => true,
  delivery: () => 'delivery_1',
  routes: async () => null,
  read: async () => [],
});

describe('WebhookSources', () => {
  it('finds a source by the name the world addresses it with', () => {
    const sources = WebhookSources.of([source('github'), source('sentry')]);

    expect(sources.find('sentry')?.key).toBe('sentry');
  });

  it('finds nothing for a source nobody registered', () => {
    expect(WebhookSources.of([source('github')]).find('sentry')).toBeNull();
  });

  it('finds nothing for an empty name', () => {
    expect(WebhookSources.of([source('github')]).find('')).toBeNull();
  });

  it('reads its sources no sooner than it is called itself', () => {
    let reads = 0;
    const sources = new WebhookSources(() => {
      reads += 1;
      return [source('github')];
    });

    expect(reads).toBe(0);
    expect(sources.find('github')?.key).toBe('github');
    expect(reads).toBe(1);
  });

  it('reads them once, however often it is called', () => {
    let reads = 0;
    const sources = new WebhookSources(() => {
      reads += 1;
      return [source('github')];
    });

    sources.find('github');
    sources.find('github');
    expect(sources.all).toHaveLength(1);
    expect(reads).toBe(1);
  });

  it('contains every source registered', () => {
    const sources = WebhookSources.of([source('github'), source('sentry')]);

    expect(sources.all.map((each) => each.key)).toEqual(['github', 'sentry']);
  });
});
