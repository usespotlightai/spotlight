import type { CreateHarnessProfileCommand } from '@configuration/application/commands/create-harness-profile.command';
import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import { HarnessProfileProblems } from '@configuration/application/rendering/harness-profile-problems';
import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileAlreadyDefinedError } from '@configuration/domain/exceptions/harness-profile-already-defined.error';
import { SecretsUnheldError } from '@configuration/domain/exceptions/secrets-unheld.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
    private readonly secrets: HeldSecretsPort,
    private readonly profiles: HarnessProfileRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateHarnessProfileCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const cleared = await this.access.clearanceOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      const team = await this.teams.find(cleared.teamId);

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
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = HarnessProfile.define({
              key: compiled.key,
              settings: compiled.settings,
              id: HarnessProfileId.of(this.ids.generate()),
              teamId: team.id,
              by: Attribution.of(command.actor, team.workspaceId),
              held: await this.secrets.held(team.id),
            });

            await this.profiles.save(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof SecretsUnheldError) {
          return {
            outcome: 'invalid',
            problems: HarnessProfileProblems.unheld(error.key, error.unheld),
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
      rethrowAsFault(error);
    }
  }
}
