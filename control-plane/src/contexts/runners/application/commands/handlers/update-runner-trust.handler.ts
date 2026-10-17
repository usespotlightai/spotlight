import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateRunnerTrustCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { RunnerTrustKeyFixedError } from '@runners/domain/exceptions/runner-trust-key-fixed.error';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateRunnerTrustHandler
  implements
    CommandHandlerPort<UpdateRunnerTrustCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly trusts: RunnerTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateRunnerTrustCommand,
  ): Promise<ResourceUpdated | null> {
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
        return forbiddenTo('manage-runners');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.trust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.inTransaction(() =>
        this.trusts.save(
          existing.redefinedAs(
            compiled,
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof RunnerTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof RunnerTrustKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.keyFixed(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
