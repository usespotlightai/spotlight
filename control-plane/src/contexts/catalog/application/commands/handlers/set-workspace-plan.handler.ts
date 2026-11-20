import type { SetWorkspacePlanCommand } from '@catalog/application/commands/workspace-plan.commands';
import type { PlanTermDto } from '@catalog/application/dto/workspace-summary.dto';
import { WorkspaceSummaryMapper } from '@catalog/application/mappers/workspace-summary.mapper';
import type { WorkspacesPort } from '@catalog/application/ports/workspaces.port';
import type { WorkspacePlanAdministration } from '@catalog/application/services/workspace-plan-administration.service';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { Plan } from '@catalog/domain/value-objects/plan.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SetWorkspacePlanHandler implements CommandHandlerPort<
  SetWorkspacePlanCommand,
  PlanTermDto | null
> {
  constructor(
    private readonly workspaces: WorkspacesPort,
    private readonly administration: WorkspacePlanAdministration,
  ) {}

  async execute(command: SetWorkspacePlanCommand): Promise<PlanTermDto | null> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);
      const term = PlanTerm.of(Plan.of(command.plan), command.expiresAt);

      if (!(await this.workspaces.find(workspaceId))) {
        return null;
      }

      await this.administration.set(workspaceId, term);

      return WorkspaceSummaryMapper.toPlanTerm(term);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
