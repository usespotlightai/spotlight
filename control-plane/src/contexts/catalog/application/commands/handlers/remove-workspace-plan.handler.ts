import type { RemoveWorkspacePlanCommand } from '@catalog/application/commands/workspace-plan.commands';
import type { WorkspacesPort } from '@catalog/application/ports/workspaces.port';
import type { WorkspacePlanAdministration } from '@catalog/application/services/workspace-plan-administration.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RemoveWorkspacePlanHandler implements CommandHandlerPort<
  RemoveWorkspacePlanCommand,
  boolean
> {
  constructor(
    private readonly workspaces: WorkspacesPort,
    private readonly administration: WorkspacePlanAdministration,
  ) {}

  async execute(command: RemoveWorkspacePlanCommand): Promise<boolean> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);

      if (!(await this.workspaces.find(workspaceId))) {
        return false;
      }

      await this.administration.remove(workspaceId);

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
