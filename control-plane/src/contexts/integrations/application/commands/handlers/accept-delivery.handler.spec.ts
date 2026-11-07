import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import { AcceptDeliveryHandler } from '@integrations/application/commands/handlers/accept-delivery.handler';
import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import type { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const RAW = new Uint8Array([1, 2, 3]);

const provider = (
  verifies: (delivered: Delivered) => boolean = () => true,
  over: Partial<WebhookProviderPort> = {},
) =>
  ({
    key: 'github',
    happenings: [],
    verifies: vi.fn(async (delivered: Delivered) => verifies(delivered)),
    delivery: (delivered: Delivered) =>
      String(
        (delivered.headers as Record<string, string>)['x-delivery'] ??
          'unnamed',
      ),
    routes: async () => null,
    read: async () => [],
    ...over,
  }) satisfies WebhookProviderPort;

const workspaces = {
  identifyTeam: async (_slug: string, teamKey: string) =>
    teamKey === 'platform'
      ? { workspaceId: WorkspaceId.of('ws_1'), teamId: TeamId.of('team_1') }
      : null,
} as unknown as WorkspaceReaderPort;

const accepting = (
  providers: WebhookProviderPort[] = [provider()],
  configured: WebhookProviderPort[] = [],
) => {
  const taken: InboundDelivery[] = [];
  const deliveries = {
    add: vi.fn(async (delivery: InboundDelivery) => {
      const first = !taken.some(
        (each) =>
          each.integration.equals(delivery.integration) &&
          each.id === delivery.id,
      );
      taken.push(delivery);
      return first;
    }),
    claimNext: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  } satisfies InboundDeliveryRepository;
  const logger = {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    handler: new AcceptDeliveryHandler(
      new ProviderForDelivery(WebhookProviders.of(providers), {
        find: async (_team, key) =>
          configured.find((each) => each.key === key) ?? null,
        all: async () => configured,
      }),
      workspaces,
      deliveries,
      { now: () => NOW } as ClockPort,
      logger,
    ),
    deliveries,
    taken,
    logger,
  };
};

const delivered = (
  id = 'd_1',
  body: unknown = { action: 'closed' },
  raw: Uint8Array | null = RAW,
): Delivered => ({
  headers: { 'x-delivery': id },
  body,
  raw,
});

const accept = (
  integration = 'github',
  over: {
    delivered?: Delivered;
    to?: { slug: string; teamKey: string } | null;
    cause?: string | null;
  } = {},
) =>
  new AcceptDeliveryCommand(
    integration,
    over.to ?? null,
    over.delivered ?? delivered(),
    over.cause ?? null,
  );

describe('AcceptDeliveryHandler', () => {
  it('stores the delivery as it arrived, under the name of its integration', async () => {
    const { handler, taken } = accepting();

    expect(
      await handler.execute(accept('github', { cause: 'firing_1' })),
    ).toEqual({
      kind: 'accepted',
    });

    expect(taken).toHaveLength(1);
    expect(taken[0]?.integration.value).toBe('github');
    expect(taken[0]?.to).toBeNull();
    expect(taken[0]?.id).toBe('d_1');
    expect(taken[0]?.headers).toEqual({ 'x-delivery': 'd_1' });
    expect(taken[0]?.body).toEqual({ action: 'closed' });
    expect(taken[0]?.causeFiringId?.value).toBe('firing_1');
    expect(taken[0]?.progress).toEqual({ kind: 'pending', dueAt: NOW });
  });

  it('stores no cause for a blank cause header', async () => {
    const { handler, taken } = accepting();

    await handler.execute(accept('github', { cause: '  ' }));

    expect(taken[0]?.causeFiringId).toBeNull();
  });

  it('offers the same delivery to the store under one name', async () => {
    const { handler, deliveries } = accepting();

    await handler.execute(accept());
    await handler.execute(accept());

    expect(deliveries.add).toHaveBeenCalledTimes(2);
    expect(await deliveries.add.mock.results[0]?.value).toBe(true);
    expect(await deliveries.add.mock.results[1]?.value).toBe(false);
  });

  it('reads nothing of the delivery beyond what to call it', async () => {
    const { handler, taken } = accepting();
    const unreadable = { not: 'anything a provider would recognise' };

    await handler.execute(
      accept('github', { delivered: delivered('d_2', unreadable) }),
    );

    expect(taken[0]?.body).toEqual(unreadable);
  });

  it('hands the provider the body as it arrived, byte for byte', async () => {
    const github = provider();
    const { handler } = accepting([github]);

    await handler.execute(accept());

    expect(github.verifies).toHaveBeenCalledWith({
      headers: { 'x-delivery': 'd_1' },
      body: { action: 'closed' },
      raw: RAW,
    });
  });

  it('stores a delivery for the team it was addressed to', async () => {
    const { handler, taken } = accepting(
      [],
      [provider(() => true, { key: 'linear' })],
    );

    await handler.execute(
      accept('linear', { to: { slug: 'acme', teamKey: 'platform' } }),
    );

    expect(taken[0]?.to).toEqual({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      teamKey: 'platform',
    });
  });

  it('refuses a team delivery for a built-in provider', async () => {
    const { handler, taken } = accepting();

    expect(
      await handler.execute(
        accept('github', { to: { slug: 'acme', teamKey: 'platform' } }),
      ),
    ).toEqual({ kind: 'refused' });
    expect(taken).toHaveLength(0);
  });

  it('refuses a delivery for a team nobody knows', async () => {
    const { handler, taken, logger } = accepting();

    expect(
      await handler.execute(
        accept('github', { to: { slug: 'acme', teamKey: 'nobody' } }),
      ),
    ).toEqual({ kind: 'refused' });
    expect(taken).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'unknown-team' }),
      'Refused a webhook delivery',
    );
  });

  it('refuses a provider nobody registered, and takes in nothing', async () => {
    const { handler, taken } = accepting();

    expect(await handler.execute(accept('sentry'))).toEqual({
      kind: 'refused',
    });
    expect(taken).toHaveLength(0);
  });

  it('refuses what the provider will not vouch for', async () => {
    const { handler, taken } = accepting([provider(() => false)]);

    expect(await handler.execute(accept())).toEqual({ kind: 'refused' });
    expect(taken).toHaveLength(0);
  });

  it('refuses a delivery whose body was never stored', async () => {
    const { handler } = accepting([provider((each) => each.raw !== null)]);

    expect(
      await handler.execute(
        accept('github', { delivered: delivered('d_1', {}, null) }),
      ),
    ).toEqual({ kind: 'refused' });
  });

  it('refuses a delivery it could not verify, telling only the log why', async () => {
    const { handler, logger } = accepting([
      provider(() => {
        throw new Error(
          'Secret GITHUB_SECRET not found. Please create it first.',
        );
      }),
    ]);

    expect(await handler.execute(accept())).toEqual({ kind: 'refused' });
    expect(logger.warn).toHaveBeenCalledWith(
      {
        integration: 'github',
        error: 'Secret GITHUB_SECRET not found. Please create it first.',
      },
      'A webhook delivery could not be verified',
    );
  });

  it('answers a delivery the provider answers, and stores nothing', async () => {
    const { handler, taken } = accepting([
      provider(() => true, { answer: () => 'challenge_1' }),
    ]);

    expect(await handler.execute(accept())).toEqual({
      kind: 'answered',
      body: 'challenge_1',
    });
    expect(taken).toHaveLength(0);
  });
});
