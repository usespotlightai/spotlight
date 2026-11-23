import type { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import type { PlatformPoolChangeDto } from '@runners/application/dto/platform-pool.dto';
import type { PlatformPools } from '@runners/application/services/platform-pools.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The caller authorises the operator of the deployment. This handler does no permission check.
export class SetPlatformPoolHandler implements CommandHandlerPort<
  SetPlatformPoolCommand,
  PlatformPoolChangeDto | null
> {
  constructor(private readonly platformPools: PlatformPools) {}

  async execute(
    command: SetPlatformPoolCommand,
  ): Promise<PlatformPoolChangeDto | null> {
    try {
      return await this.platformPools.set(
        WorkspaceId.of(command.workspaceId),
        command.change,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
