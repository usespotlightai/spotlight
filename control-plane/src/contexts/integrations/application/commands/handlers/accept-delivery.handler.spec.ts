import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import { AcceptDeliveryHandler } from '@integrations/application/commands/handlers/accept-delivery.handler';
import type {
  DeliveryQueuePort,
  StoredDelivery,
} from '@integrations/application/ports/delivery-queue.port';
import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { describe, expect, it, vi } from 'vitest';

const github = {
  key: 'github',
  happenings: [],
  verifies: async () => true,
  delivery: (delivered: Delivered) =>
    String(
      (delivered.headers as Record<string, string>)['x-delivery'] ?? 'unnamed',
    ),
  routes: async () => null,
  read: async () => [],
} satisfies WebhookProviderPort;

const accepting = () => {
  const taken: StoredDelivery[] = [];
  const queue = {
    accept: vi.fn(async (delivery: StoredDelivery) => {
      const first = !taken.some(
        (each) =>
          each.integration === delivery.integration && each.id === delivery.id,
      );
      taken.push(delivery);
      return first;
    }),
  } as unknown as DeliveryQueuePort;

  return {
    handler: new AcceptDeliveryHandler(
      new ProviderForDelivery(WebhookProviders.of([github]), {
        find: async () => null,
        all: async () => [],
      }),
      queue,
    ),
    queue,
    taken,
  };
};

const delivered = (id = 'd_1', body: unknown = { action: 'closed' }) => ({
  headers: { 'x-delivery': id },
  body,
  raw: null,
});

describe('AcceptDeliveryHandler', () => {
  it('stores the delivery as it arrived, under the name of its integration', async () => {
    const { handler, taken } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );

    expect(taken).toEqual([
      {
        integration: 'github',
        workspaceId: '',
        teamId: '',
        teamKey: '',
        id: 'd_1',
        headers: { 'x-delivery': 'd_1' },
        body: { action: 'closed' },
        attempts: 0,
      },
    ]);
  });

  it('offers the same delivery to the queue under one name', async () => {
    const { handler, queue } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );
    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );

    expect(queue.accept).toHaveBeenCalledTimes(2);
    expect(
      await (queue.accept as never as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value,
    ).toBe(true);
    expect(
      await (queue.accept as never as ReturnType<typeof vi.fn>).mock.results[1]
        ?.value,
    ).toBe(false);
  });

  it('reads nothing of the delivery beyond what to call it', async () => {
    const { handler, taken } = accepting();
    const unreadable = { not: 'anything a provider would recognise' };

    await handler.execute(
      new AcceptDeliveryCommand(
        'github',
        '',
        '',
        '',
        delivered('d_2', unreadable),
      ),
    );

    expect(taken[0]?.body).toEqual(unreadable);
  });

  it('takes in nothing for a provider nobody registered', async () => {
    const { handler, taken } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('sentry', '', '', '', delivered()),
    );

    expect(taken).toHaveLength(0);
  });
});
