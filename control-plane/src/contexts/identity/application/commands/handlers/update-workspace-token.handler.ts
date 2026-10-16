import type { UpdateWorkspaceTokenCommand } from '@identity/application/commands/workspace-token.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { MintedTokenFixedError } from '@identity/domain/exceptions/minted-token-fixed.error';
import { WorkspaceTokenTermsFixedError } from '@identity/domain/exceptions/workspace-token-terms-fixed.error';
import { WorkspaceTokenVersionConflictError } from '@identity/domain/exceptions/workspace-token-version-conflict.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export class UpdateWorkspaceTokenHandler
  implements
    CommandHandlerPort<UpdateWorkspaceTokenCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateWorkspaceTokenCommand,
  ): Promise<ResourceUpdated | null> {
    const id = WorkspaceTokenId.of(command.tokenId);

    try {
      const standing = await this.tokens.find(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.administers) {
        return forbiddenTo('administer');
      }

      standing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.workspaceToken(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.run(() =>
        this.tokens.save(
          standing.redescribed(
            compiled.terms,
            Attribution.of(command.actor, standing.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof WorkspaceTokenVersionConflictError) {
        const current = await this.tokens.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof WorkspaceTokenTermsFixedError ||
        error instanceof MintedTokenFixedError
      ) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.tokenRefused(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
