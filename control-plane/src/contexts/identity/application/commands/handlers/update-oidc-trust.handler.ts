import type { UpdateOidcTrustCommand } from '@identity/application/commands/oidc-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { OidcTrustVersionConflictError } from '@identity/domain/exceptions/oidc-trust-version-conflict.error';
import { ScopesExceedCallerError } from '@identity/domain/exceptions/scopes-exceed-caller.error';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';

export class UpdateOidcTrustHandler
  implements CommandHandlerPort<UpdateOidcTrustCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly trusts: OidcTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateOidcTrustCommand,
  ): Promise<ResourceUpdated | null> {
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

      const compiled = this.definitions.oidcTrust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const updated = existing.update(
        compiled.spec,
        ScopeCeiling.of(command.actor.principal),
        ChangeActor.of(command.actor, permissions.workspaceId),
      );

      if (updated !== existing) {
        await this.transaction.inTransaction(() => this.trusts.save(updated));
      }

      return { outcome: 'updated', id: id.value };
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

      if (error instanceof ImmutableFieldError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.trustInvalid(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
