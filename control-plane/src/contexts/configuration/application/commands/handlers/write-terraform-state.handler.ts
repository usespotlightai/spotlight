import type { WriteTerraformStateCommand } from '@configuration/application/commands/write-terraform-state.command';
import type { StateChanged } from '@configuration/application/dto/terraform-state-outcomes.dto';
import type { TerraformStateBodiesPort } from '@configuration/application/ports/terraform-state-bodies.port';
import type { TerraformStates } from '@configuration/application/services/terraform-states.service';
import type { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import { TerraformStateLockedError } from '@configuration/domain/exceptions/terraform-state-locked.error';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class WriteTerraformStateHandler
  implements CommandHandlerPort<WriteTerraformStateCommand, StateChanged>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly named: TerraformStates,
    private readonly states: TerraformStateRepository,
    private readonly bodies: TerraformStateBodiesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: WriteTerraformStateCommand): Promise<StateChanged> {
    try {
      const permissions = await this.access.permissionsInSlug(
        command.slug,
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      const snapshot = StateSnapshot.read({
        text: new TextDecoder().decode(command.body),
        md5: command.md5,
        size: command.body.byteLength,
      });
      const state = await this.named.named(
        permissions.workspaceId,
        StateName.of(command.name),
      );
      const { state: written, version } = state.write({
        id: StateVersionId.of(this.ids.generate()),
        snapshot,
        lockId: command.lockId,
        by: ChangeActor.of(command.actor, permissions.workspaceId),
        at: this.clock.now(),
      });

      await this.bodies.put(written, version, command.body);

      try {
        await this.states.save(written);
      } catch (error) {
        await this.bodies.remove(written, version).catch(() => undefined);
        throw error;
      }

      await this.pruned(written);

      return { outcome: 'done' };
    } catch (error) {
      if (error instanceof TerraformStateLockedError) {
        return { outcome: 'locked', holder: error.holder.info };
      }

      rethrowAsApplicationError(error);
    }
  }

  private async pruned(state: TerraformState): Promise<void> {
    const keptFrom = state.keptFrom;

    if (keptFrom === null) {
      return;
    }

    try {
      const old = await this.states.versionsBefore(state, keptFrom);

      for (const version of old) {
        await this.bodies.remove(state, version);
      }

      await this.states.removeVersions(state, old);
    } catch (error) {
      this.logger.warn(
        {
          workspaceId: state.workspaceId.value,
          state: state.name.value,
          error,
        },
        'could not remove old Terraform state versions',
      );
    }
  }
}
