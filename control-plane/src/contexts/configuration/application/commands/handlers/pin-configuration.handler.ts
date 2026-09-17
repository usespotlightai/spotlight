import type { PinConfigurationCommand } from '@configuration/application/commands/pin-configuration.command';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import type { RepositoryProvisioning } from '@configuration/application/services/repository-provisioning.service';
import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class PinConfigurationHandler
  implements CommandHandlerPort<PinConfigurationCommand, boolean>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly homes: ConfigurationHomeRepository,
    private readonly target: ConfigurationTarget,
    private readonly provisioning: RepositoryProvisioning,
  ) {}

  async execute(command: PinConfigurationCommand): Promise<boolean> {
    try {
      const team = await this.teams.viewedBy(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!team?.administers) {
        return false;
      }

      const repository = command.repository
        ? Repository.of(command.repository)
        : null;

      if (repository) {
        const target = this.target.at(team, repository);

        if (!target) {
          throw new NoGitHubInstallationError();
        }

        if ((await this.provisioning.ensure(target)) === 'refused') {
          throw new UpstreamRefusedError(
            `Making ${repository.value}`,
            'GitHub would not create it',
          );
        }
      }

      const home =
        (await this.homes.find(team.teamId)) ??
        ConfigurationHome.unpinned(team.workspaceId, team.teamId);
      const pinned = home.keptInto(repository);

      await this.homes.save(pinned);

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
