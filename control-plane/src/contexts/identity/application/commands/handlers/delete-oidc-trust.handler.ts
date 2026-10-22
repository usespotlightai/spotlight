import type { DeleteOidcTrustCommand } from '@identity/application/commands/oidc-trust.commands';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { OidcTrustVersionConflictError } from '@identity/domain/exceptions/oidc-trust-version-conflict.error';
import { ScopesExceedCallerError } from '@identity/domain/exceptions/scopes-exceed-caller.error';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';

export class DeleteOidcTrustHandler
  implements CommandHandlerPort<DeleteOidcTrustCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: OidcTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteOidcTrustCommand,
  ): Promise<ResourceDeleted | null> {
    const id = OidcTrustId.of(command.trustId);

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

      if (!permissions.managesOidcTrusts) {
        return forbiddenTo('trusts');
      }

      existing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(() =>
        this.trusts.save(
          existing.delete(
            ScopeCeiling.of(command.actor.principal),
            ChangeActor.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof OidcTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof ScopesExceedCallerError) {
        return forbiddenTo('trusts');
      }

      rethrowAsApplicationError(error);
    }
  }
}
