import { ReadDeliveryHandler } from '@integrations/application/commands/handlers/read-delivery.handler';
import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { StoredDelivery } from '@integrations/application/ports/delivery-inbox.port';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { causationInMemory } from '@shared-kernel/application/ports/causation.fake-spec';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import { describe, expect, it, vi } from 'vitest';

const MERGED = 'github.pull_request.merged';

const word = (ourOwn = false): Happened => ({
  happening: MERGED,
  told: 'The pull request was merged.',
  spoken: false,
  state: 'raised',
  concerns: { branch: 'spotlight/task_1', marks: [] },
  said: null,
  ourOwn,
  opens: null,
});

const stored: StoredDelivery = {
  source: 'github',
  workspaceId: '',
  teamId: '',
  teamKey: '',
  id: 'delivery_1',
  headers: {},
  body: {},
  attempts: 0,
};

const reading = (
  carried: readonly Happened[],
  over: { workspaceId?: string | null } = {},
) => {
  const react = vi.fn(async () => {});
  const causation = causationInMemory();
  const chains: string[] = [];
  const firings = {
    chainOf: vi.fn(async (workspaceId: string, firingId: string) =>
      workspaceId === 'ws_1' && firingId === 'firing_1' ? FIRED : null,
    ),
  } as unknown as HookFiringHistoryPort;
  react.mockImplementation(async () => {
    chains.push(causation.current().saying);
  });
  const handler = new ReadDeliveryHandler(
    new SourceForDelivery(
      WebhookSources.of([
        {
          key: 'github',
          happenings: [],
          verifies: async () => true,
          delivery: () => 'delivery_1',
          routes: async () =>
            over.workspaceId === null
              ? null
              : WorkspaceId.of(over.workspaceId ?? 'ws_1'),
          read: async () => carried,
        } satisfies WebhookSourcePort,
      ]),
      { find: async () => null, all: async () => [] },
    ),
    { react },
    firings,
    causation,
  );

  return { handler, react, firings, chains };
};

const FIRED = CausalChain.none().followedBy({
  kind: 'hook',
  key: 'hook:notify_id:task.moved:task_1:build → review',
  saying: 'the hook notify',
});

describe('ReadDeliveryHandler', () => {
  it('reacts in the chain of causes of the firing a delivery names', async () => {
    const { handler, chains } = reading([word()]);

    await handler.execute(
      new ReadDeliveryCommand({
        ...stored,
        headers: { 'spotlight-cause': 'firing_1' },
      }),
    );

    expect(chains).toEqual(['the hook notify → a delivery from github']);
  });

  it('starts a chain of its own for a delivery that names no firing it knows', async () => {
    const { handler, chains } = reading([word()]);

    await handler.execute(
      new ReadDeliveryCommand({
        ...stored,
        headers: { 'spotlight-cause': 'firing_elsewhere' },
      }),
    );
    await handler.execute(new ReadDeliveryCommand(stored));

    expect(chains).toEqual(['', '']);
  });

  it('hands what a host said to the workspace it came from', async () => {
    const { handler, react } = reading([word()]);

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      null,
      [word()],
      'delivery:github::delivery_1',
    );
  });

  it('says nothing about what Spotlight itself did', async () => {
    const { handler, react } = reading([word(true)]);

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).not.toHaveBeenCalled();
  });

  it('says nothing for an installation no workspace has claimed', async () => {
    const { handler, react } = reading([word()], { workspaceId: null });

    await handler.execute(new ReadDeliveryCommand(stored));

    expect(react).not.toHaveBeenCalled();
  });
});
