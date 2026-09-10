import type { SetUpLinesCommand } from '@application/commands/set-up-lines.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { SeedConfiguration } from '@application/services/seed-configuration.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * A team's harness and repositories chosen for each of its lines, then written
 * down as the pull request that opens its configuration. Nothing is written to
 * the repository until this is asked for, so the choices are made first.
 *
 * Only an owner or admin may, since it decides what an agent is told to do.
 */
export class SetUpLinesHandler
  implements CommandHandlerPort<SetUpLinesCommand, OpenedPullRequestDto | null>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly teams: TeamRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly seeding: SeedConfiguration,
    private readonly settling: SettleSetup,
  ) {}

  async execute(
    command: SetUpLinesCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      const workspace = await this.authorization.connectableBy(
        command.teamId,
        command.viewerId,
      );

      if (!workspace) {
        return null;
      }

      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.configRepository) {
        return null;
      }

      // The board is not written here; the chosen lines are rendered into the
      // setup pull request, and the board takes them on when it is merged and
      // read back, exactly as any later change does.
      const setups = new Map(command.lines.map((each) => [each.key, each]));
      const lines = (await this.lines.ofTeam(team.id)).map((line) => {
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

      const opened = await this.seeding.seed(
        workspace,
        team.configRepository,
        lines,
      );

      await this.settling.forTeam(team.id);

      return opened;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
