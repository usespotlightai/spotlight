import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import type { IntegrationCreatedDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class CreateIntegrationHandler
  implements
    CommandHandlerPort<CreateIntegrationCommand, IntegrationCreatedDto | null>
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
  ): Promise<IntegrationCreatedDto | null> {
    try {
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.requesterId),
      );
      const team = membership?.administers
        ? await this.teams.find(membership.teamId)
        : null;

      if (!membership || !team) {
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
        return await this.transaction.run(async () => {
          const claim = await this.creates.claim(create);

          if (claim.kind !== 'fresh') {
            return claim.kind === 'replay'
              ? { outcome: 'created', id: claim.createdId, replayed: true }
              : { outcome: 'key-reused' };
          }

          const defined = IntegrationDefinition.define({
            ...compiled,
            id: IntegrationDefinitionId.of(this.ids.generate()),
            teamId: membership.teamId,
          });

          await this.definitions.save(defined);
          await this.creates.created(create, defined.id.value);

          return { outcome: 'created', id: defined.id.value, replayed: false };
        });
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
