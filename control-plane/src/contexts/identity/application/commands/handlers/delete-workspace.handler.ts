import type { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import type { IdentityResourcesPort } from '@identity/application/ports/identity-resources.port';
import type { WorkspaceHoldingsPort } from '@identity/application/ports/workspace-holdings.port';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceMovedOnError } from '@identity/domain/exceptions/workspace-moved-on.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { Holdings } from '@identity/domain/value-objects/holdings.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteWorkspaceHandler
  implements CommandHandlerPort<DeleteWorkspaceCommand, ResourceDeleted | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly resources: IdentityResourcesPort,
    private readonly holdings: WorkspaceHoldingsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceId.of(command.workspaceId);

    try {
      const standing = await this.workspaces.find(id);

      const cleared = standing?.clearanceFor(command.actor.principal);

      if (!standing || !cleared?.reads) {
        return null;
      }

      if (!cleared.administers) {
        return forbiddenTo('administer');
      }

      standing.expecting(command.expectedVersion);

      const held = Holdings.of(await this.holdings.of(id));

      await this.transaction.run(async () => {
        const teams = await this.resources.teamKeysIn(id);
        const tokens = await this.resources.tokenNamesIn(id);
        const trusts = await this.resources.tokenTrustKeysIn(id);

        await this.workspaces.save(
          standing.closed(
            teams.map((each) => TeamKey.of(each)),
            tokens.map((each) => TokenName.of(each)),
            trusts.map((each) => TokenTrustKey.of(each)),
            held,
            Attribution.of(command.actor, id),
          ),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceMovedOnError) {
        const current = await this.workspaces.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof WorkspaceInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
