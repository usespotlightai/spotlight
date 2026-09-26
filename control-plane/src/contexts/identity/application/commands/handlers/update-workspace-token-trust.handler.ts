import type { UpdateWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustKeyFixedError } from '@identity/domain/exceptions/token-trust-key-fixed.error';
import { TokenTrustMovedOnError } from '@identity/domain/exceptions/token-trust-moved-on.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const standing = await this.trusts.find(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesTokenTrusts) {
        return forbiddenTo('manage-token-trusts');
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.definitions.workspaceTokenTrust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const { principal } = command.actor;
      const redefined = standing.redefinedAs(
        compiled.terms,
        principal.kind === 'token' ? principal.scopes : null,
        Attribution.of(command.actor, cleared.workspaceId),
      );

      if (redefined !== standing) {
        await this.transaction.run(() => this.trusts.save(redefined));
      }

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof TokenTrustMovedOnError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
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

      rethrowAsFault(error);
    }
  }
}
