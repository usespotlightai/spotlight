import type { UpdateManagedPoolCommand } from '@runners/application/commands/managed-pool.commands';
import type { ManagedPoolChangeDto } from '@runners/application/dto/managed-pool.dto';
import type { ManagedPools } from '@runners/application/services/managed-pools.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class UpdateManagedPoolHandler implements CommandHandlerPort<
  UpdateManagedPoolCommand,
  ManagedPoolChangeDto | null
> {
  constructor(private readonly managed: ManagedPools) {}

  async execute(
    command: UpdateManagedPoolCommand,
  ): Promise<ManagedPoolChangeDto | null> {
    try {
      const workspaceId = WorkspaceId.of(command.workspaceId);

      return await this.managed.update(
        workspaceId,
        command.disabled,
        ChangeActor.of(command.actor, workspaceId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
