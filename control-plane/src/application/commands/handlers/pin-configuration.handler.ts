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
