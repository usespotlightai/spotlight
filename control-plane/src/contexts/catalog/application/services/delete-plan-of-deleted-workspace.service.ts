import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeletePlanOfDeletedWorkspace {
  constructor(private readonly plans: WorkspacePlanRepository) {}

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    const current = await this.plans.find(workspaceId);

    if (current) {
      await this.plans.save(current.delete(ChangeActor.spotlight(workspaceId)));
    }
  }
}
