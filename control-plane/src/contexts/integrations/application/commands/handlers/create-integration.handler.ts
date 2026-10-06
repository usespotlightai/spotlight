import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import type { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
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
import type { IdempotentRecallsPort } from '@shared-kernel/application/ports/idempotent-recalls.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import {
  createdEarlier,
  createdOnce,
} from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

export class CreateIntegrationHandler
  implements
    CommandHandlerPort<CreateIntegrationCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly sources: IntegrationSources,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly recalls: IdempotentRecallsPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateIntegrationCommand,
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

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          integration: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };
      const earlier = await createdEarlier(this.recalls, create);

      if (earlier) {
        return earlier;
      }

      const { compiled, reading } = await this.sources.compiled({
        definition: command.definition,
        teamId: cleared.teamId,
        standing: null,
      });

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const address = IntegrationAddress.of(
        team.key,
        compiled.integration.source,
      );

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = IntegrationDefinition.define({
              ...compiled,
              reading,
              id: IntegrationDefinitionId.of(this.ids.generate()),
              teamId: cleared.teamId,
              by: Attribution.of(command.actor, cleared.workspaceId),
            });

            await this.definitions.save(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof IntegrationAlreadyDefinedError) {
          return { outcome: 'taken', address: address.toString() };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
