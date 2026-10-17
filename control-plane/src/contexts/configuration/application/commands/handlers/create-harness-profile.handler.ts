import type { CreateHarnessProfileCommand } from '@configuration/application/commands/create-harness-profile.command';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import { HarnessProfileProblems } from '@configuration/application/rendering/harness-profile-problems';
import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileAlreadyDefinedError } from '@configuration/domain/exceptions/harness-profile-already-defined.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class CreateHarnessProfileHandler
  implements
    CommandHandlerPort<CreateHarnessProfileCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HarnessProfileCompilerPort,
    private readonly secrets: SecretNamesPort,
    private readonly profiles: HarnessProfileRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateHarnessProfileCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const permissions = await this.access.permissionsOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      const team = await this.teams.find(permissions.teamId);

      if (!team) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          harnessProfile: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const defined = HarnessProfile.define({
              key: compiled.key,
              settings: compiled.settings,
              id: HarnessProfileId.of(this.ids.generate()),
              teamId: team.id,
              by: Attribution.of(command.actor, team.workspaceId),
              existingSecrets: await this.secrets.ofTeam(team.id),
            });

            await this.profiles.save(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof MissingSecretsError) {
          return {
            outcome: 'invalid',
            problems: HarnessProfileProblems.missing(error.key, error.missing),
          };
        }

        if (error instanceof HarnessProfileAlreadyDefinedError) {
          return {
            outcome: 'taken',
            address: TeamAddress.of(team.key, compiled.key.value).toString(),
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
