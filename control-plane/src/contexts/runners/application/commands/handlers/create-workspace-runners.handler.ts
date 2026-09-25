import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateWorkspaceRunnersCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { WorkspaceRunners } from '@runners/domain/aggregates/workspace-runners.aggregate';
import { WorkspaceRunnersAlreadyDeclaredError } from '@runners/domain/exceptions/workspace-runners-already-declared.error';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateWorkspaceRunnersHandler
  implements
    CommandHandlerPort<CreateWorkspaceRunnersCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateWorkspaceRunnersCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!cleared) {
        return null;
      }

      if (!cleared.managesRunners) {
        return forbiddenTo('manage-runners');
      }

      const compiled = this.definitions.workspaceRunners(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          workspaceRunners: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const declared = WorkspaceRunners.declare({
              id: WorkspaceRunnersId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              by: Attribution.of(command.actor, cleared.workspaceId),
              runners: compiled.runners,
              trusts: compiled.trusts,
              pools: compiled.pools,
            });

            await this.declarations.add(declared);

            return declared.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof WorkspaceRunnersAlreadyDeclaredError) {
          return { outcome: 'taken', address: cleared.slug };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
