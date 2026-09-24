import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateRunnerCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { RunnerNameFixedError } from '@runners/domain/exceptions/runner-name-fixed.error';
import { RunnerRevisedError } from '@runners/domain/exceptions/runner-revised.error';
import { RunnerTokenSpentError } from '@runners/domain/exceptions/runner-token-spent.error';
import { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { refuseTokenHeldElsewhere } from '@runners/domain/services/token-holding';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class UpdateRunnerHandler
  implements CommandHandlerPort<UpdateRunnerCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly runners: RunnerRepository,
    private readonly tokens: TokenMintPort,
  ) {}

  async execute(command: UpdateRunnerCommand): Promise<ResourceUpdated | null> {
    const id = RunnerId.of(command.runnerId);

    try {
      const standing = await this.runners.find(id);
      const cleared =
        standing && !standing.revoked
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

      standing.expecting(command.expectedVersion);

      const compiled = this.definitions.runner(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const tokenHash = compiled.token
        ? TokenHash.of(this.tokens.hash(compiled.token))
        : null;
      const by = Attribution.of(command.actor, cleared.workspaceId);

      if (tokenHash) {
        refuseTokenHeldElsewhere(
          await this.runners.findByTokenHash(tokenHash),
          id,
        );
      }

      await reviseRunner(this.runners, id, (runner) => {
        runner.expecting(command.expectedVersion);

        return runner.redefinedAs(
          { name: compiled.name, labels: compiled.labels, tokenHash },
          by,
        );
      });

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof RunnerRevisedError) {
        const current = await this.runners.find(id);

        return current && !current.revoked
          ? { outcome: 'moved-on', currentVersion: current.revision }
          : null;
      }

      if (error instanceof RunnerNameFixedError) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.nameFixed(error)],
        };
      }

      if (
        error instanceof RunnerTokenTakenError ||
        error instanceof RunnerTokenSpentError
      ) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.tokenRefused(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
