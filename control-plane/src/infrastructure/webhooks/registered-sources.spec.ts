import type {
  Happened,
  HappeningDeclaration,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { markedSources } from '@infrastructure/webhooks/registered-sources';
import {
  WEBHOOK_SOURCE,
  WebhookSource,
} from '@infrastructure/webhooks/webhook-source.decorator';
import type { DiscoveryService } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

const sourceOf = (named: string) => {
  @WebhookSource()
  class Marked implements WebhookSourcePort {
    readonly key = named;
    readonly happenings: readonly HappeningDeclaration[] = [];

    async verifies(): Promise<boolean> {
      return true;
    }

    delivery(): string {
      return 'delivery_1';
    }

    async routes(): Promise<null> {
      return null;
    }

    async read(): Promise<readonly Happened[]> {
      return [];
    }
  }

  return Marked;
};

class NotASource {}

const discovering = (
  providers: { metatype: unknown; instance: unknown }[],
): DiscoveryService =>
  ({ getProviders: () => providers }) as unknown as DiscoveryService;

const asClass = (named: string) => {
  const Marked = sourceOf(named);

  return { metatype: Marked, instance: new Marked() };
};

const byFactory = (named: string) => {
  const Marked = sourceOf(named);

  return { metatype: () => new Marked(), instance: new Marked() };
};

describe('markedSources', () => {
  it('holds every provider wearing the mark', () => {
    const sources = markedSources(
      discovering([asClass('github'), asClass('sentry')]),
    );

    expect(sources.map((each) => each.key)).toEqual(['github', 'sentry']);
  });

  it('holds one the container was given a factory for', () => {
    const sources = markedSources(discovering([byFactory('github')]));

    expect(sources.map((each) => each.key)).toEqual(['github']);
  });

  it('holds nothing else the container happens to have', () => {
    const sources = markedSources(
      discovering([
        asClass('github'),
        { metatype: NotASource, instance: new NotASource() },
      ]),
    );

    expect(sources.map((each) => each.key)).toEqual(['github']);
  });

  it('passes over a provider with nothing behind it', () => {
    const { metatype } = asClass('github');

    expect(markedSources(discovering([{ metatype, instance: null }]))).toEqual(
      [],
    );
  });

  it('marks a source so the container can find it', () => {
    expect(Reflect.getMetadata(WEBHOOK_SOURCE, sourceOf('github'))).toBe(true);
    expect(Reflect.getMetadata(WEBHOOK_SOURCE, NotASource)).toBeUndefined();
  });
});
