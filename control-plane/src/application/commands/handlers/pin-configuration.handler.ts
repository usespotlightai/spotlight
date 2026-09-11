import type { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { RepositoryProvisioning } from '@application/services/repository-provisioning.service';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Worth saying rather than leaving to the fallback scan: two teams that chose
 * nothing land on the same repository and read each other's files.
 *
 * The workspace says who may, because it decides what an agent is told to do.
 */
export class PinConfigurationHandler
  implements CommandHandlerPort<PinConfigurationCommand, boolean>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly teams: TeamRepository,
    private readonly target: ConfigurationTarget,
    private readonly provisioning: RepositoryProvisioning,
    private readonly settling: SettleSetup,
  ) {}

  async execute(command: PinConfigurationCommand): Promise<boolean> {
    try {
      // Someone outside the team is not told it is there at all; only an owner
      // or admin may choose its repository. The workspace comes back to seed on.
      const workspace = await this.authorization.connectableBy(
        command.teamId,
        command.viewerId,
      );

      if (!workspace) {
        return false;
      }

      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team) {
        return false;
      }

      const repository = command.repository
        ? Repository.of(command.repository)
        : null;

      // Only the repository is readied here; what to write into it is chosen
      // and written later, when the lines are set up. Nothing is thrown where
      // the host will not make it: seeding finds nothing to write against,
      // which is what the team is shown.
      const target = repository ? this.target.at(workspace, repository) : null;

      if (target) {
        await this.provisioning.ensure(target);
      }

      await this.teams.save(team.keepsConfigurationIn(repository));
      await this.settling.forTeam(team.id);

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
