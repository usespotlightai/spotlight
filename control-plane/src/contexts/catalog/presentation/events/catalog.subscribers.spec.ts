import { catalogSubscribers } from '@catalog/presentation/events/catalog.subscribers';
import { WORKSPACE_DELETED } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = 'workspace_acme';

const deletedWorkspace = {
  kind: WORKSPACE_DELETED,
  workspaceId: WORKSPACE,
  slug: 'acme',
} as never;

const deleting = () => {
  const plans: WorkspaceId[] = [];
  const calls: WorkspaceId[] = [];
  const subscribers = catalogSubscribers({
    plans: {
      deleteForWorkspace: async (workspaceId) => void plans.push(workspaceId),
    },
    meter: {
      record: async () => undefined,
      deleteForWorkspace: async (workspaceId) => void calls.push(workspaceId),
    },
  });

  return { plans, calls, subscribers };
};

describe('catalogSubscribers', () => {
  it('deletes the plan of a deleted workspace', async () => {
    const { plans, calls, subscribers } = deleting();

    await subscribers
      .find((each) => each.name === 'catalog.delete-plan-of-deleted-workspace')
      ?.handle(deletedWorkspace);

    expect(plans.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(calls).toEqual([]);
  });

  it('deletes the metered calls of a deleted workspace', async () => {
    const { plans, calls, subscribers } = deleting();

    await subscribers
      .find((each) => each.name === 'catalog.delete-calls-of-deleted-workspace')
      ?.handle(deletedWorkspace);

    expect(calls.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(plans).toEqual([]);
  });
});
