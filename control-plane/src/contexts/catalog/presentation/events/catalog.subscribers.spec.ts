import type { DeleteWorkspacePlanOfDeletedWorkspace } from '@catalog/application/services/delete-workspace-plan-of-deleted-workspace.service';
import { catalogSubscribers } from '@catalog/presentation/events/catalog.subscribers';
import { WORKSPACE_DELETED } from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
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
    deleting: {
      deleteForWorkspace: async (workspaceId: WorkspaceId) =>
        void plans.push(workspaceId),
    } as unknown as DeleteWorkspacePlanOfDeletedWorkspace,
    calls: {
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
      ?.handle(deletedWorkspace, anOutboxRecord());

    expect(plans.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(calls).toEqual([]);
  });

  it('deletes the catalog calls of a deleted workspace', async () => {
    const { plans, calls, subscribers } = deleting();

    await subscribers
      .find((each) => each.name === 'catalog.delete-calls-of-deleted-workspace')
      ?.handle(deletedWorkspace, anOutboxRecord());

    expect(calls.map((each) => each.value)).toEqual([WORKSPACE]);
    expect(plans).toEqual([]);
  });
});
