import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateRunnerTrustCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerTrustAlreadyDefinedError } from '@runners/domain/exceptions/runner-trust-already-defined.error';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateRunnerTrustHandler
  implements
    CommandHandlerPort<CreateRunnerTrustCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly trusts: RunnerTrustRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateRunnerTrustCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return forbiddenTo('manage-runners');
      }

      const compiled = this.definitions.trust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          runnerTrust: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const defined = RunnerTrust.define({
              id: RunnerTrustId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              by: Attribution.of(command.actor, permissions.workspaceId),
              key: compiled.key,
              workload: compiled.workload,
              labels: compiled.labels,
            });

            await this.trusts.add(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof RunnerTrustAlreadyDefinedError) {
          return { outcome: 'taken', address: compiled.key.value };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
