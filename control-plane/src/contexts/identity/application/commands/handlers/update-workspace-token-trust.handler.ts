import type { UpdateWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustKeyFixedError } from '@identity/domain/exceptions/token-trust-key-fixed.error';
import { TokenTrustVersionConflictError } from '@identity/domain/exceptions/token-trust-version-conflict.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class UpdateWorkspaceTokenTrustHandler
  implements
    CommandHandlerPort<UpdateWorkspaceTokenTrustCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateWorkspaceTokenTrustCommand,
  ): Promise<ResourceUpdated | null> {
    const id = WorkspaceTokenTrustId.of(command.trustId);

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

      if (!permissions.managesTokenTrusts) {
        return forbiddenTo('manage-token-trusts');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.workspaceTokenTrust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const redefined = existing.redefinedAs(
        compiled.terms,
        Grantor.of(command.actor.principal),
        Attribution.of(command.actor, permissions.workspaceId),
      );

      if (redefined !== existing) {
        await this.transaction.inTransaction(() => this.trusts.save(redefined));
      }

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof TokenTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof TokenTrustBeyondGrantorError) {
        return forbiddenTo('manage-token-trusts');
      }

      if (error instanceof TokenTrustKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.trustRefused(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
