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

/** A host wearing the mark, as one written here would be. */
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

/** Provided as a class: the container knows it by the class itself. */
const asClass = (named: string) => {
  const Marked = sourceOf(named);

  return { metatype: Marked, instance: new Marked() };
};

/** Provided by a factory: the container knows it only by the factory. */
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

  // A source built by a factory is registered under the factory, and the
  // factory wears nothing. Looking there and no further would find none.
  it('holds one the container was given a factory for', () => {
    const sources = markedSources(discovering([byFactory('github')]));

    expect(sources.map((each) => each.key)).toEqual(['github']);
  });

  // Most of what the container holds is not a host we listen to.
  it('holds nothing else the container happens to have', () => {
    const sources = markedSources(
      discovering([
        asClass('github'),
        { metatype: NotASource, instance: new NotASource() },
      ]),
    );

    expect(sources.map((each) => each.key)).toEqual(['github']);
  });

  // A provider Nest has not built yet is not one to hand a delivery to.
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
