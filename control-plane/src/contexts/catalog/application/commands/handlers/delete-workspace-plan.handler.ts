import type { DeleteWorkspacePlanCommand } from '@catalog/application/commands/workspace-plan.commands';
import type { WorkspacePlanRepository } from '@catalog/domain/repositories/workspace-plan.repository';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspacePlanHandler implements CommandHandlerPort<
  DeleteWorkspacePlanCommand,
  boolean
> {
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly plans: WorkspacePlanRepository,
  ) {}

  async execute(command: DeleteWorkspacePlanCommand): Promise<boolean> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);

      if (!(await this.workspaces.isOpen(workspaceId))) {
        return false;
      }

      const current = await this.plans.find(workspaceId);

      if (current) {
        await this.plans.save(
          current.delete(ChangeActor.spotlight(workspaceId)),
        );
      }

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
