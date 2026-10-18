import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import type { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyExistsError } from '@integrations/domain/exceptions/integration-already-exists.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
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
import type { IdempotentLookupsPort } from '@shared-kernel/application/ports/idempotent-lookups.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import {
  createIdempotently,
  lookupIdempotentCreate,
} from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

export class CreateIntegrationHandler
  implements
    CommandHandlerPort<CreateIntegrationCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly specs: IntegrationSpecs,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly lookups: IdempotentLookupsPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateIntegrationCommand,
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

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          integration: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };
      const earlier = await lookupIdempotentCreate(this.lookups, create);

      if (earlier) {
        return earlier;
      }

      const { compiled, reading } = await this.specs.compiled({
        definition: command.definition,
        teamId: permissions.teamId,
        current: null,
      });

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const address = IntegrationAddress.of(team.key, compiled.integration.key);

      try {
        return await this.transaction.inTransaction(() =>
          createIdempotently(this.creates, create, async () => {
            const created = IntegrationDefinition.create({
              ...compiled,
              reading,
              id: IntegrationDefinitionId.of(this.ids.generate()),
              teamId: permissions.teamId,
              by: ChangeActor.of(command.actor, permissions.workspaceId),
            });

            await this.definitions.save(created);

            return created.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof IntegrationAlreadyExistsError) {
          return { outcome: 'already-exists', address: address.toString() };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
