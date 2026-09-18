import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { SetUpLinesCommand } from '@work/application/commands/set-up-lines.command';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import type { SeedConfiguration } from '@work/application/services/seed-configuration.service';
import type { SettleSetup } from '@work/application/services/settle-setup.service';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { Effort } from '@work/domain/value-objects/effort.vo';

export class SetUpLinesHandler
  implements CommandHandlerPort<SetUpLinesCommand, ProposedChangeDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineRepository,
    private readonly seeding: SeedConfiguration,
    private readonly settling: SettleSetup,
  ) {}

  async execute(command: SetUpLinesCommand): Promise<ProposedChangeDto | null> {
    try {
      const standing = await this.access.onTeam(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!standing?.administers) {
        return null;
      }

      const teamId = TeamId.of(command.teamId);

      const setups = new Map(command.lines.map((each) => [each.key, each]));
      const lines = (await this.lines.ofTeam(teamId)).map((line) => {
        const setup = setups.get(line.key.value);

        return setup
          ? line
              .runsOn(
                setup.harness ? HarnessId.of(setup.harness) : null,
                setup.model ? HarnessModel.of(setup.model) : null,
              )
              .thinksAt(setup.effort ? Effort.of(setup.effort) : null)
              .worksIn(setup.repositories.map((each) => Repository.of(each)))
          : line;
      });

      const opened = await this.seeding.seed(teamId, lines);

      await this.settling.forTeam(teamId);

      return opened;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
