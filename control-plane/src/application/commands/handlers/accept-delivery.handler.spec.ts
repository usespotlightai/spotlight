import { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import { AcceptDeliveryHandler } from '@application/commands/handlers/accept-delivery.handler';
import type {
  DeliveryInboxPort,
  StoredDelivery,
} from '@application/ports/delivery-inbox.port';
import type {
  Delivered,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { SourceForDelivery } from '@application/services/source-for-delivery.service';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { describe, expect, it, vi } from 'vitest';

/** Names a delivery the way GitHub does: by what the host called it. */
const github = {
  key: 'github',
  happenings: [],
  verifies: async () => true,
  delivery: (delivered: Delivered) =>
    String(
      (delivered.headers as Record<string, string>)['x-delivery'] ?? 'unnamed',
    ),
  routes: async () => null,
  read: () => [],
} satisfies WebhookSourcePort;

const accepting = () => {
  const taken: StoredDelivery[] = [];
  const inbox = {
    accept: vi.fn(async (delivery: StoredDelivery) => {
      const first = !taken.some(
        (each) => each.source === delivery.source && each.id === delivery.id,
      );
      taken.push(delivery);
      return first;
    }),
  } as unknown as DeliveryInboxPort;

  return {
    handler: new AcceptDeliveryHandler(
      new SourceForDelivery(WebhookSources.of([github]), {
        find: async () => null,
        all: async () => [],
      }),
      inbox,
    ),
    inbox,
    taken,
  };
};

const delivered = (id = 'd_1', body: unknown = { action: 'closed' }) => ({
  headers: { 'x-delivery': id },
  body,
  raw: null,
});

describe('AcceptDeliveryHandler', () => {
  it('keeps the delivery as it arrived, under the name its host gave it', async () => {
    const { handler, taken } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );

    expect(taken).toEqual([
      {
        source: 'github',
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

  // A host retries, and a person can ask it to send the same word again.
  // Taking it in is what makes it ours, and the inbox says so only once.
  it('offers the same delivery to the inbox under one name', async () => {
    const { handler, inbox } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );
    await handler.execute(
      new AcceptDeliveryCommand('github', '', '', '', delivered()),
    );

    expect(inbox.accept).toHaveBeenCalledTimes(2);
    expect(
      await (inbox.accept as never as ReturnType<typeof vi.fn>).mock.results[0]
        ?.value,
    ).toBe(true);
    expect(
      await (inbox.accept as never as ReturnType<typeof vi.fn>).mock.results[1]
        ?.value,
    ).toBe(false);
  });

  it('reads nothing of the delivery beyond what to call it', async () => {
    const { handler, taken } = accepting();
    const unreadable = { not: 'anything a source would recognise' };

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

  it('takes in nothing for a source nobody registered', async () => {
    const { handler, taken } = accepting();

    await handler.execute(
      new AcceptDeliveryCommand('sentry', '', '', '', delivered()),
    );

    expect(taken).toHaveLength(0);
  });
});
