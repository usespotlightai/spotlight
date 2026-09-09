import type { WebhookSourcePort } from '@application/ports/webhook-source.port';
import { WebhookSources } from '@application/services/webhook-sources.service';
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

  // A delivery to a source nobody registered is nobody's to act on, and
  // guessing which was meant would act on the wrong host's word.
  it('finds nothing for a source nobody registered', () => {
    expect(WebhookSources.of([source('github')]).find('sentry')).toBeNull();
  });

  it('finds nothing for an empty name', () => {
    expect(WebhookSources.of([source('github')]).find('')).toBeNull();
  });

  // Asked when something wants a source, not before: what is registered is
  // only settled once everything has been put together.
  it('asks for its sources no sooner than it is asked itself', () => {
    let asked = 0;
    const sources = new WebhookSources(() => {
      asked += 1;
      return [source('github')];
    });

    expect(asked).toBe(0);
    expect(sources.find('github')?.key).toBe('github');
    expect(asked).toBe(1);
  });

  it('asks for them once, however often it is asked', () => {
    let asked = 0;
    const sources = new WebhookSources(() => {
      asked += 1;
      return [source('github')];
    });

    sources.find('github');
    sources.find('github');
    expect(sources.all).toHaveLength(1);
    expect(asked).toBe(1);
  });

  it('holds every source registered', () => {
    const sources = WebhookSources.of([source('github'), source('sentry')]);

    expect(sources.all.map((each) => each.key)).toEqual(['github', 'sentry']);
  });
});
