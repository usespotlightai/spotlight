import type { SetWorkspacePlanCommand } from '@catalog/application/commands/workspace-plan.commands';
import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';
import { PlanTermMapper } from '@catalog/application/mappers/plan-term.mapper';
import type { WorkspaceDirectoryPort } from '@catalog/application/ports/workspace-directory.port';
import { WorkspacePlan } from '@catalog/domain/aggregates/workspace-plan.aggregate';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SetWorkspacePlanHandler implements CommandHandlerPort<
  SetWorkspacePlanCommand,
  PlanTermDto | null
> {
  constructor(
    private readonly directory: WorkspaceDirectoryPort,
    private readonly plans: WorkspacePlanRepository,
  ) {}

  async execute(command: SetWorkspacePlanCommand): Promise<PlanTermDto | null> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);
      const term = PlanTerm.of(Plan.of(command.plan), command.expiresAt);

      if (!(await this.directory.find(workspaceId))) {
        return null;
      }

      const current = await this.plans.find(workspaceId);
      const next = WorkspacePlan.set(current, {
        workspaceId,
        term,
        by: ChangeActor.spotlight(workspaceId),
      });

      if (next && current) {
        await this.plans.save(next);
      } else if (next) {
        await this.plans.add(next);
      }

      return PlanTermMapper.toDto(term);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
