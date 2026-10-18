import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteRunnerTrustCommand } from '@runners/application/commands/runner-resource.commands';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class DeleteRunnerTrustHandler
  implements
    CommandHandlerPort<DeleteRunnerTrustCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: RunnerTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteRunnerTrustCommand,
  ): Promise<ResourceDeleted | null> {
    const id = RunnerTrustId.of(command.trustId);

    try {
      const existing = await this.trusts.find(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return forbiddenTo('runners');
      }

      existing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(() =>
        this.trusts.save(
          existing.delete(
            ChangeActor.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof RunnerTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
