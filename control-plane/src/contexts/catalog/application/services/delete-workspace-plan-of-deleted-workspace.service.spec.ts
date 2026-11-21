import { DeleteWorkspacePlanOfDeletedWorkspace } from '@catalog/application/services/delete-workspace-plan-of-deleted-workspace.service';
import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_deleted');

const deleting = (current: PlanTerm | null) => {
  const saved: WorkspacePlan[] = [];
  const plans: WorkspacePlanRepository = {
    find: async () =>
      current
        ? WorkspacePlan.rehydrate({
            workspaceId: WORKSPACE,
            term: current,
            version: 0,
          })
        : null,
    add: async () => undefined,
    save: async (plan) => void saved.push(plan),
  };

  return { service: new DeleteWorkspacePlanOfDeletedWorkspace(plans), saved };
};

describe('DeleteWorkspacePlanOfDeletedWorkspace', () => {
  it('deletes the plan of a deleted workspace, as Spotlight', async () => {
    const { service, saved } = deleting(PlanTerm.of(Plan.team));

    await service.deleteForWorkspace(WORKSPACE);

    expect(saved.map((each) => each.isDeleted)).toEqual([true]);
    expect(
      saved
        .flatMap((each) => each.pullEvents() as readonly WorkspacePlanDeleted[])
        .map((each) => each.change.by.actor),
    ).toEqual([null]);
  });

  it('has nothing to delete when the workspace had no plan', async () => {
    const { service, saved } = deleting(null);

    await service.deleteForWorkspace(WORKSPACE);

    expect(saved).toEqual([]);
  });
});
