import type { UnlockTerraformStateCommand } from '@configuration/application/commands/unlock-terraform-state.command';
import type { StateChanged } from '@configuration/application/dto/terraform-state-outcomes.dto';
import { TerraformStateLockNotYoursError } from '@configuration/domain/exceptions/terraform-state-lock-not-yours.error';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class UnlockTerraformStateHandler
  implements CommandHandlerPort<UnlockTerraformStateCommand, StateChanged>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly states: TerraformStateRepository,
  ) {}

  async execute(command: UnlockTerraformStateCommand): Promise<StateChanged> {
    try {
      const permissions = await this.access.permissionsInSlug(
        command.slug,
        command.principal,
      );

      if (!permissions) {
        return null;
      }

      const forced = command.info === null;

      if (!(forced ? permissions.configures : permissions.plans)) {
        return forbiddenTo(forced ? 'configure' : 'plan');
      }

      const id = forced ? null : StateLock.idIn(command.info);
      const state = await this.states.named(
        permissions.workspaceId,
        StateName.of(command.name),
      );
      const unlocked =
        id === null
          ? state?.forceUnlock()
          : state?.unlock(id, {
              principal: command.principal.toString(),
              mayForce: permissions.configures,
            });

      if (unlocked && unlocked !== state) {
        await this.states.save(unlocked);
      }

      return { outcome: 'done' };
    } catch (error) {
      if (error instanceof TerraformStateLockedError) {
        return { outcome: 'locked', holder: error.holder.info };
      }

      if (error instanceof TerraformStateLockNotYoursError) {
        return forbiddenTo('configure');
      }

      rethrowAsApplicationError(error);
    }
  }
}
