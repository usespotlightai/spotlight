import type { SetWorkspacePlanCommand } from '@catalog/application/commands/workspace-plan.commands';
import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';
import { PlanTermMapper } from '@catalog/application/mappers/plan-term.mapper';
import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SetWorkspacePlanHandler implements CommandHandlerPort<
  SetWorkspacePlanCommand,
  PlanTermDto | null
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly plans: WorkspacePlanRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SetWorkspacePlanCommand): Promise<PlanTermDto | null> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);
      const term = PlanTerm.of(Plan.of(command.plan), command.expiresAt);

      if (!(await this.workspaces.isOpen(workspaceId))) {
        return null;
      }

      const by = ChangeActor.spotlight(workspaceId);
      const now = this.clock.now();
      const current = await this.plans.find(workspaceId);

      if (current) {
        const changed = current.set(term, by, now);

        if (changed) {
          await this.plans.save(changed);
        }
      } else {
        const created = WorkspacePlan.create({ workspaceId, term, by, now });

        if (created) {
          await this.plans.add(created);
        }
      }

      return PlanTermMapper.toDto(term);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
