import type {
  HappeningDeclaration,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { markedProviders } from '@integrations/infrastructure/webhooks/registered-providers';
import {
  WEBHOOK_PROVIDER,
  WebhookProvider,
} from '@integrations/infrastructure/webhooks/webhook-provider.decorator';
import type { DiscoveryService } from '@nestjs/core';
import { type Happened } from '@work/application/contracts/happenings.contract';
import { describe, expect, it } from 'vitest';

const providerOf = (named: string) => {
  @WebhookProvider()
  class Marked implements WebhookProviderPort {
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

class NotAProvider {}

const discovering = (
  providers: { metatype: unknown; instance: unknown }[],
): DiscoveryService =>
  ({ getProviders: () => providers }) as unknown as DiscoveryService;

const asClass = (named: string) => {
  const Marked = providerOf(named);

  return { metatype: Marked, instance: new Marked() };
};

const byFactory = (named: string) => {
  const Marked = providerOf(named);

  return { metatype: () => new Marked(), instance: new Marked() };
};

describe('markedProviders', () => {
  it('contains every provider that has the mark', () => {
    const providers = markedProviders(
      discovering([asClass('github'), asClass('sentry')]),
    );

    expect(providers.map((each) => each.key)).toEqual(['github', 'sentry']);
  });

  it('contains one the container was given a factory for', () => {
    const providers = markedProviders(discovering([byFactory('github')]));

    expect(providers.map((each) => each.key)).toEqual(['github']);
  });

  it('contains nothing else the container happens to have', () => {
    const providers = markedProviders(
      discovering([
        asClass('github'),
        { metatype: NotAProvider, instance: new NotAProvider() },
      ]),
    );

    expect(providers.map((each) => each.key)).toEqual(['github']);
  });

  it('skips a provider with nothing behind it', () => {
    const { metatype } = asClass('github');

    expect(
      markedProviders(discovering([{ metatype, instance: null }])),
    ).toEqual([]);
  });

  it('marks a provider so the container can find it', () => {
    expect(Reflect.getMetadata(WEBHOOK_PROVIDER, providerOf('github'))).toBe(
      true,
    );
    expect(Reflect.getMetadata(WEBHOOK_PROVIDER, NotAProvider)).toBeUndefined();
  });
});
