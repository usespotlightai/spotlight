import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import {
  FORBIDDEN,
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
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class CreateIntegrationHandler
  implements
    CommandHandlerPort<CreateIntegrationCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: IntegrationCompilerPort,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateIntegrationCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.requesterId),
      );
      if (!membership) {
        return null;
      }

      if (!membership.administers) {
        return FORBIDDEN;
      }

      const team = await this.teams.find(membership.teamId);

      if (!team) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const address = IntegrationAddress.of(
        team.key,
        compiled.integration.source,
      );
      const create: IdempotentCreate = {
        by: command.requesterId,
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          integration: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = IntegrationDefinition.define({
              ...compiled,
              id: IntegrationDefinitionId.of(this.ids.generate()),
              teamId: membership.teamId,
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
