import type { UpdateHarnessProfileCommand } from '@configuration/application/commands/update-harness-profile.command';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import { HarnessProfileProblems } from '@configuration/application/rendering/harness-profile-problems';
import { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateHarnessProfileHandler
  implements
    CommandHandlerPort<UpdateHarnessProfileCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: HarnessProfileCompilerPort,
    private readonly secrets: SecretNamesPort,
    private readonly profiles: HarnessProfileRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateHarnessProfileCommand,
  ): Promise<ResourceUpdated | null> {
    const id = HarnessProfileId.of(command.profileId);

    try {
      const standing = await this.profiles.withId(id);
      const permissions = standing
        ? await this.access.permissionsOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      standing.assertVersion(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.inTransaction(async () =>
        this.profiles.save(
          standing.redefinedAs(
            compiled,
            Attribution.of(command.actor, permissions.workspaceId),
            await this.secrets.ofTeam(standing.teamId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof HarnessProfileVersionConflictError) {
        const current = await this.profiles.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof MissingSecretsError) {
        return {
          outcome: 'invalid',
          problems: HarnessProfileProblems.missing(error.key, error.missing),
        };
      }

      if (error instanceof HarnessProfileKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [HarnessProfileProblems.keyFixed(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
