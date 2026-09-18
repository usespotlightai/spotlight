import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { type EnrolRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { type EnrolledRunnerDto } from '@runners/application/dto/runner.dto';
import { NotWorkspaceAdministratorError } from '@runners/application/errors/not-workspace-administrator.error';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class EnrolRunnerHandler
  implements CommandHandlerPort<EnrolRunnerCommand, EnrolledRunnerDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenMintPort,
  ) {}

  async execute(
    command: EnrolRunnerCommand,
  ): Promise<EnrolledRunnerDto | null> {
    try {
      const membership = await this.access.inWorkspace(
        command.slug,
        UserId.of(command.viewerId),
      );

      if (!membership) {
        return null;
      }

      if (!membership.administers) {
        throw new NotWorkspaceAdministratorError();
      }

      const name = RunnerName.of(command.name);
      const minted = this.tokens.mint();

      const enrolled = Runner.enrol({
        id: RunnerId.of(this.ids.generate()),
        workspaceId: membership.workspaceId,
        name,
        tokenHash: TokenHash.of(minted.hash),
      });

      await this.runners.add(enrolled);

      return {
        runnerId: enrolled.id.value,
        name: name.value,
        token: minted.token,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
