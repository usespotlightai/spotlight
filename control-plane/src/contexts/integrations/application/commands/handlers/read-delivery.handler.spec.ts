import { ReadDeliveryHandler } from '@integrations/application/commands/handlers/read-delivery.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { ReceivedDelivery } from '@integrations/application/dto/received-delivery.dto';
import { causationInMemory } from '@integrations/application/ports/causation.fake-spec';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { CausalChain } from '@integrations/domain/value-objects/causal-chain.vo';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { WorkDeliveryReactions } from '@integrations/infrastructure/acl/delivery-reactions.adapter';
import { ProviderDeliveryReader } from '@integrations/infrastructure/webhooks/provider-delivery-reader';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { HappeningsReaction } from '@work/application/ports/happening-reactions.port';
import { describe, expect, it, vi } from 'vitest';

const MERGED = 'github.pull_request.merged';

const payloadOf = (ourOwn = false): Happened => ({
  happening: MERGED,
  summary: 'The pull request was merged.',
  answers: false,
  state: 'raised',
  correlationKeys: { branch: 'spotlight/task_1', marks: [] },
  message: null,
  ourOwn,
  opens: null,
});

const stored: ReceivedDelivery = {
  integration: 'github',
  to: null,
  id: 'delivery_1',
  headers: {},
  body: {},
  causeFiringId: null,
};

const reading = (
  carried: readonly Happened[],
  over: { workspaceId?: string | null } = {},
) => {
  const react = vi.fn(
    async (): Promise<HappeningsReaction> => ({ kind: 'reacted' }),
  );
  const read = vi.fn(async () => carried);
  const causation = causationInMemory();
  const chains: string[] = [];
  const firings = {
    chainOf: vi.fn(async (workspaceId: WorkspaceId, firingId: HookFiringId) =>
      workspaceId.value === 'ws_1' && firingId.value === 'firing_1'
        ? FIRED
        : null,
    ),
  } as unknown as HookFiringHistoryPort;
  react.mockImplementation(async () => {
    chains.push(causation.current().description);
    return { kind: 'reacted' };
  });
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const handler = new ReadDeliveryHandler(
    new ProviderForDelivery(
      WebhookProviders.of([
        {
          key: 'github',
          happenings: [],
          verifies: async () => true,
          delivery: () => 'delivery_1',
          routes: async () =>
            over.workspaceId === null
              ? null
              : WorkspaceId.of(over.workspaceId ?? 'ws_1'),
          read,
        } satisfies WebhookProviderPort,
      ]),
      { find: async () => null, all: async () => [] },
    ),
    new ProviderDeliveryReader(),
    new WorkDeliveryReactions({ react }),
    firings,
    causation,
    logger,
  );

  return { handler, react, read, firings, chains, logger };
};

const FIRED = CausalChain.none().append({
  kind: 'hook',
  key: 'hook:notify_id:task.moved:task_1:build → review',
  description: 'the hook notify',
});

describe('ReadDeliveryHandler', () => {
  it('reacts in the chain of causes of the firing a delivery names', async () => {
    const { handler, chains } = reading([payloadOf()]);

    await handler.execute(
      new ReadDeliveryCommand({
        ...stored,
        causeFiringId: HookFiringId.of('firing_1'),
      }),
    );

    expect(chains).toEqual(['the hook notify → a delivery from github']);
  });

  it('starts a chain of its own for a delivery that names no firing it knows', async () => {
    const { handler, chains } = reading([payloadOf()]);

    await handler.execute(
      new ReadDeliveryCommand({
        ...stored,
        causeFiringId: HookFiringId.of('firing_elsewhere'),
      }),
    );
    await handler.execute(new ReadDeliveryCommand(stored));

    expect(chains).toEqual(['', '']);
  });

  it('hands what a service said to the workspace it came from', async () => {
    const { handler, react } = reading([payloadOf()]);

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      null,
      [payloadOf()],
      'delivery:github::delivery_1',
    );
  });

  it('says nothing about what Spotlight itself did', async () => {
    const { handler, react, logger } = reading([payloadOf(true)]);

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ deliveryId: stored.id, reason: 'nothing-new' }),
      'Ignored a delivery',
    );
  });

  it('says nothing for an installation no workspace has claimed', async () => {
    const { handler, react, logger } = reading([payloadOf()], {
      workspaceId: null,
    });

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reason: 'no-workspace' }),
      'Ignored a delivery',
    );
  });

  it.each<[string, boolean, DeliveryFailure]>([
    [
      'a failure Work says may pass',
      true,
      DeliveryFailure.transient('changed meanwhile'),
    ],
    [
      'a failure Work says is for good',
      false,
      DeliveryFailure.permanent('changed meanwhile'),
    ],
  ])('says whether to read again after %s', async (_, transient, failure) => {
    const { handler, react } = reading([payloadOf()]);
    react.mockResolvedValueOnce({
      kind: 'failed',
      transient,
      reason: 'changed meanwhile',
    });

    await expect(
      handler.execute(new ReadDeliveryCommand(stored)),
    ).resolves.toEqual(failure);
  });

  it('says whether to read again when the service could not be read', async () => {
    const { handler, read, react } = reading([payloadOf()]);
    read.mockRejectedValueOnce(new UpstreamError('reading', 'no answer'));

    await expect(
      handler.execute(new ReadDeliveryCommand(stored)),
    ).resolves.toEqual(DeliveryFailure.transient('reading: no answer'));
    expect(react).not.toHaveBeenCalled();
  });

  it('lets a failure it does not know through', async () => {
    const { handler, react } = reading([payloadOf()]);
    react.mockRejectedValueOnce(new TypeError('a bug'));

    await expect(
      handler.execute(new ReadDeliveryCommand(stored)),
    ).rejects.toThrow('a bug');
  });

  it('has no failure for a delivery it read', async () => {
    const { handler } = reading([payloadOf()]);

    await expect(
      handler.execute(new ReadDeliveryCommand(stored)),
    ).resolves.toBeNull();
  });
});
