import { catalogSubscribers } from '@catalog/presentation/events/catalog.subscribers';
import { WORKSPACE_CLOSED } from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = 'workspace_acme';

const closed = {
  kind: WORKSPACE_CLOSED,
  workspaceId: WORKSPACE,
  slug: 'acme',
} as never;

const forgetting = () => {
  const plans: WorkspaceId[] = [];
  const calls: WorkspaceId[] = [];
  const subscribers = catalogSubscribers({
    plans: {
      of: async () => {
        throw new Error('not read on close');
      },
      forget: async (workspaceId) => void plans.push(workspaceId),
    },
    meter: {
      record: async () => undefined,
      forget: async (workspaceId) => void calls.push(workspaceId),
    },
  });

  return { plans, calls, subscribers };
};

describe('catalogSubscribers', () => {
  it('forgets the plan of a closed workspace', async () => {
    const { plans, calls, subscribers } = forgetting();

    await subscribers
      .find((each) => each.name === 'catalog.forget-plan-of-closed-workspace')
      ?.handle(closed);

    expect(plans.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(calls).toEqual([]);
  });

  it('forgets the metered calls of a closed workspace', async () => {
    const { plans, calls, subscribers } = forgetting();

    await subscribers
      .find((each) => each.name === 'catalog.forget-calls-of-closed-workspace')
      ?.handle(closed);

    expect(calls.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(plans).toEqual([]);
  });
});
