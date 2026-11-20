import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import type { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspacePlanAdministration {
  constructor(private readonly plans: WorkspacePlanRepository) {}

  async set(workspaceId: WorkspaceId, term: PlanTerm): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);
    const current = await this.plans.find(workspaceId);

    if (current) {
      await this.plans.save(current.changeTo(term, by));
    } else if (!term.isDefault) {
      await this.plans.add(WorkspacePlan.assign({ workspaceId, term, by }));
    }
  }

  async remove(workspaceId: WorkspaceId): Promise<void> {
    const current = await this.plans.find(workspaceId);

    if (current) {
      await this.plans.save(current.remove(ChangeActor.spotlight(workspaceId)));
    }
  }
}
