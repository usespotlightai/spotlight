import type { LockTerraformStateCommand } from '@configuration/application/commands/lock-terraform-state.command';
import type { StateChanged } from '@configuration/application/dto/terraform-state-outcomes.dto';
import type { TerraformStates } from '@configuration/application/services/terraform-states.service';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import { TerraformStateVersionConflictError } from '@configuration/domain/exceptions/terraform-state-version-conflict.error';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class LockTerraformStateHandler
  implements CommandHandlerPort<LockTerraformStateCommand, StateChanged>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly named: TerraformStates,
    private readonly states: TerraformStateRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: LockTerraformStateCommand): Promise<StateChanged> {
    try {
      const permissions = await this.access.permissionsInSlug(
        command.slug,
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.plans) {
        return forbiddenTo('plan');
      }

      const lock = StateLock.of({
        info: command.info,
        lockedBy: command.actor.principal.toString(),
        lockedAt: this.clock.now(),
      });
      const name = StateName.of(command.name);

      try {
        await this.take(permissions.workspaceId, name, lock);
      } catch (error) {
        if (!(error instanceof TerraformStateVersionConflictError)) {
          throw error;
        }

        await this.take(permissions.workspaceId, name, lock);
      }

      return { outcome: 'done' };
    } catch (error) {
      if (error instanceof TerraformStateLockedError) {
        return { outcome: 'locked', holder: error.holder.info };
      }

      rethrowAsApplicationError(error);
    }
  }

  private async take(
    workspaceId: WorkspaceId,
    name: StateName,
    lock: StateLock,
  ): Promise<void> {
    const state = await this.named.named(workspaceId, name);
    const locked = state.lockAs(lock);

    if (locked !== state || state.isNew) {
      await this.states.save(locked);
    }
  }
}
