import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateEgressCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { giveEgressToken } from '@runners/application/services/give-egress-token';
import { EgressKeyFixedError } from '@runners/domain/exceptions/egress-key-fixed.error';
import { EgressTokenSpentError } from '@runners/domain/exceptions/egress-token-spent.error';
import { EgressTokenTakenError } from '@runners/domain/exceptions/egress-token-taken.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { GivenEgressTokensRepository } from '@runners/domain/repositories/given-egress-tokens.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class UpdateEgressHandler
  implements CommandHandlerPort<UpdateEgressCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly egresses: EgressRepository,
    private readonly given: GivenEgressTokensRepository,
    private readonly tokens: TokenMintPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateEgressCommand): Promise<ResourceUpdated | null> {
    const id = EgressId.of(command.egressId);

    try {
      const standing = await this.egresses.find(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesRunners) {
        return forbiddenTo('manage-runners');
      }

      standing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.egress(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const redefined = standing.redefinedAs(
        compiled,
        {
          tokenHash: compiled.token
            ? TokenHash.of(this.tokens.hash(compiled.token.revealed()))
            : null,
          tokenVersion: compiled.tokenVersion,
        },
        Attribution.of(command.actor, cleared.workspaceId),
      );

      await this.transaction.run(async () => {
        await this.egresses.save(redefined);
        await giveEgressToken(this.given, this.egresses, redefined, standing);
      });

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof EgressVersionConflictError) {
        const current = await this.egresses.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof EgressKeyFixedError ||
        error instanceof EgressTokenTakenError ||
        error instanceof EgressTokenSpentError ||
        error instanceof InvalidEgressError
      ) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.egressRefused(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
